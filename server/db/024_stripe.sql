-- ============================================================================
-- Migration 024 — Detail Support: Stripe billing wiring.
--
-- Builds on 014 (subscriptions/payments/audit) and 015 (plans/effective_plan).
-- Adds:
--   • plans.stripe_price_id / stripe_price_id_founding — maps our tiers onto
--     Stripe Prices. The founding column is what keeps the Founding Member
--     "locked-in pricing" promise honest once real money is involved: if it is
--     set, founding members check out against THAT price, not the list price.
--   • subscriptions.cancel_at_period_end — so the UI can say "cancels Aug 14"
--     instead of lying about an active plan.
--   • stripe_events — idempotency ledger. Stripe retries webhooks and can
--     deliver the same event twice; every handler claims its event here first.
--   • billing_is_live() — true once any paid tier has a real Price ID.
--   • apply_stripe_subscription() — the ONLY writer of billing state. Callable
--     by service_role alone (the webhook), never by a browser.
--
-- SECURITY NOTE — the point of this migration:
--   Until now set_subscription_plan() was granted to `authenticated`, letting
--   an owner switch their own org to Team. That was fine while nothing charged
--   money: it was the dev/plan switcher. Once Stripe is live it is a "give me
--   the paid plan for free" button. Rather than rely on remembering to revoke
--   it, the guard below is self-disarming: the moment a real Price ID is
--   attached to a paid plan, billing_is_live() flips true and the RPC starts
--   refusing. No flag to forget, no window where both paths are open.
--
-- Additive + idempotent. Run AFTER 010–023. Non-nested dollar quotes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Catalog + subscription columns
-- ---------------------------------------------------------------------------
alter table public.plans
  add column if not exists stripe_price_id          text,
  add column if not exists stripe_price_id_founding text;

comment on column public.plans.stripe_price_id is
  'Stripe Price ID (price_...) for this tier. Setting one on any paid tier turns billing live and disables the manual plan switcher.';
comment on column public.plans.stripe_price_id_founding is
  'Optional Stripe Price ID used for founding members, honouring their locked-in rate. Falls back to stripe_price_id when null.';

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) stripe_events — webhook idempotency ledger.
--    RLS on with NO policies: authenticated can never read it; service_role
--    bypasses RLS, so only the webhook touches this.
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id            text primary key,          -- Stripe event id, evt_...
  type          text not null,
  event_created timestamptz,
  processed_at  timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on table public.stripe_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) billing_is_live() — is real payment collection configured?
-- ---------------------------------------------------------------------------
create or replace function public.billing_is_live()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.plans
     where plan <> 'free' and coalesce(stripe_price_id, '') <> ''
  );
$fn$;

grant execute on function public.billing_is_live() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Lock the manual switcher once billing is live.
--    Same signature/behaviour as 015 — only the guard is new.
-- ---------------------------------------------------------------------------
create or replace function public.set_subscription_plan(p_org uuid, p_plan text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_founding boolean; v_price numeric;
begin
  -- `is distinct from`, NOT `<>`: current_org_role() returns NULL for a
  -- non-member, and `NULL <> 'owner'` evaluates to NULL, which IF treats as
  -- false — so the plain `<>` guard silently FAILS OPEN for exactly the people
  -- it exists to stop. See 025 for the same fix on the team functions.
  if public.current_org_role(p_org) is distinct from 'owner' then
    raise exception 'Only the owner can change the plan.';
  end if;
  if p_plan not in ('free', 'pro', 'team') then
    raise exception 'Unknown plan.';
  end if;

  -- Once Stripe is configured, plan state is owned by Stripe. Letting this
  -- through would hand out paid plans for free and desync us from the
  -- subscription that is actually being billed.
  if public.billing_is_live() then
    raise exception 'Plan changes go through checkout now. Use the Billing page.'
      using errcode = 'check_violation';
  end if;

  select founding_member into v_founding from public.subscriptions where org_id = p_org;
  select monthly_price  into v_price     from public.plans where plan = p_plan;

  update public.subscriptions
     set plan = p_plan::subscription_plan,
         locked_monthly_price = case when v_founding then v_price else locked_monthly_price end
   where org_id = p_org;
end $fn$;

grant execute on function public.set_subscription_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) apply_stripe_subscription() — the webhook's single write path.
--    service_role only: revoked from public/authenticated below, so a browser
--    holding an anon/authenticated JWT cannot reach it even though it is
--    SECURITY DEFINER.
-- ---------------------------------------------------------------------------
create or replace function public.apply_stripe_subscription(
  p_org                  uuid,
  p_plan                 text,
  p_status               text,
  p_customer_id          text default null,
  p_subscription_id      text default null,
  p_period_start         timestamptz default null,
  p_period_end           timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_trial_ends_at        timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_old_plan text; v_old_status text;
begin
  if p_plan not in ('free', 'pro', 'team') then
    raise exception 'Unknown plan: %', p_plan;
  end if;
  if p_status not in ('trialing', 'active', 'past_due', 'canceled') then
    raise exception 'Unknown status: %', p_status;
  end if;

  select plan::text, status::text into v_old_plan, v_old_status
    from public.subscriptions where org_id = p_org;

  if v_old_plan is null then
    raise exception 'No subscription row for org %', p_org;
  end if;

  update public.subscriptions
     set plan                   = p_plan::subscription_plan,
         status                 = p_status::subscription_status,
         stripe_customer_id     = coalesce(p_customer_id, stripe_customer_id),
         stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id),
         current_period_start   = coalesce(p_period_start, current_period_start),
         current_period_end     = coalesce(p_period_end, current_period_end),
         cancel_at_period_end   = coalesce(p_cancel_at_period_end, false),
         -- Stripe owns trial state once it is managing the subscription.
         trial_ends_at          = case when p_status = 'trialing' then p_trial_ends_at else trial_ends_at end,
         updated_at             = now()
   where org_id = p_org;

  insert into public.audit_log (org_id, actor_user_id, action, entity, meta)
  values (
    p_org, null, 'billing.stripe_sync', 'subscription',
    jsonb_build_object(
      'from',   jsonb_build_object('plan', v_old_plan, 'status', v_old_status),
      'to',     jsonb_build_object('plan', p_plan,     'status', p_status),
      'stripe_subscription_id', p_subscription_id,
      'cancel_at_period_end',   coalesce(p_cancel_at_period_end, false)
    )
  );
end $fn$;

revoke all on function public.apply_stripe_subscription(
  uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) link_stripe_customer() — records the customer id at checkout time so the
--    webhook can resolve org from customer even if metadata is missing.
--    service_role only.
-- ---------------------------------------------------------------------------
create or replace function public.link_stripe_customer(p_org uuid, p_customer_id text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.subscriptions
     set stripe_customer_id = p_customer_id, updated_at = now()
   where org_id = p_org;
  if not found then
    raise exception 'No subscription row for org %', p_org;
  end if;
end $fn$;

revoke all on function public.link_stripe_customer(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) Helpful indexes for webhook lookups
-- ---------------------------------------------------------------------------
create index if not exists idx_subscriptions_stripe_customer
  on public.subscriptions(stripe_customer_id) where stripe_customer_id is not null;
create index if not exists idx_subscriptions_stripe_subscription
  on public.subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;

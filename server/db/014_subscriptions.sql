-- ============================================================================
-- Migration 014 — Detail Support: subscriptions, payments, audit log + plan limits
--
-- Adds the billing/plan layer on top of 010–013 (Stripe NOT integrated yet —
-- only placeholder columns are reserved). Plan limits are enforced in the
-- database via triggers, so they hold no matter how a row is inserted
-- (app query, RPC, or SQL):
--   • Free  → max 25 customers, 1 seat
--   • Pro   → unlimited customers, 1 seat
--   • Team  → unlimited customers, up to 10 seats
--
-- Additive + idempotent. Run AFTER 010–013. Non-nested dollar quotes so it runs
-- cleanly in the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Enums
-- ---------------------------------------------------------------------------
do $$ begin create type subscription_plan   as enum ('free', 'pro', 'team'); exception when duplicate_object then null; end $$;
do $$ begin create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_method      as enum ('cash', 'card', 'zelle', 'venmo', 'transfer', 'other'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2) Canonical plan limits (single source of truth)
-- ---------------------------------------------------------------------------
create or replace function public.plan_seat_limit(p subscription_plan)
returns int language sql immutable as $$
  select case p when 'team' then 10 else 1 end;
$$;

create or replace function public.plan_customer_limit(p subscription_plan)
returns int language sql immutable as $$
  select case p when 'free' then 25 else null end;  -- null = unlimited
$$;

-- ---------------------------------------------------------------------------
-- 3) subscriptions — one row per organization (the billing record)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null unique references public.organizations(id) on delete cascade,
  plan                   subscription_plan not null default 'free',
  status                 subscription_status not null default 'trialing',
  seat_limit             int,                       -- kept in sync with plan by trigger
  customer_limit         int,                       -- null = unlimited
  current_period_start   timestamptz not null default now(),
  current_period_end     timestamptz,
  trial_ends_at          timestamptz,
  founding_member        boolean not null default false,
  stripe_customer_id     text,                      -- placeholder for future Stripe wiring
  stripe_subscription_id text,                      -- placeholder for future Stripe wiring
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- keep seat/customer limits aligned with the plan on insert and any plan change
create or replace function public.sync_plan_limits()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.plan is distinct from old.plan then
    new.seat_limit     := public.plan_seat_limit(new.plan);
    new.customer_limit := public.plan_customer_limit(new.plan);
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_plan_limits on public.subscriptions;
create trigger trg_sync_plan_limits before insert or update on public.subscriptions
  for each row execute function public.sync_plan_limits();

drop trigger if exists trg_touch_subscriptions on public.subscriptions;
create trigger trg_touch_subscriptions before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4) payments — linked to invoices (Stripe placeholder reserved)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  invoice_id               uuid not null references public.invoices(id) on delete cascade,
  amount                   numeric(10, 2) not null default 0,
  method                   payment_method not null default 'other',
  status                   text not null default 'recorded',
  paid_at                  timestamptz not null default now(),
  note                     text,
  stripe_payment_intent_id text,                    -- placeholder for future Stripe wiring
  created_at               timestamptz not null default now()
);
create index if not exists idx_payments_org     on public.payments(org_id);
create index if not exists idx_payments_invoice on public.payments(invoice_id);

-- ---------------------------------------------------------------------------
-- 5) audit_log — important actions (append-only; written by triggers)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action        text not null,
  entity        text,
  entity_id     uuid,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists idx_audit_org_time on public.audit_log(org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6) RLS for the new tables
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
drop policy if exists sub_read  on public.subscriptions;
drop policy if exists sub_write on public.subscriptions;
create policy sub_read  on public.subscriptions for select using (public.is_org_member(org_id));
create policy sub_write on public.subscriptions for update
  using (public.is_org_owner(org_id)) with check (public.is_org_owner(org_id));

alter table public.payments enable row level security;
drop policy if exists pay_all on public.payments;
create policy pay_all on public.payments for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

alter table public.audit_log enable row level security;
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select
  using (org_id is not null and public.is_org_admin(org_id));
-- No insert/update/delete policy: the log is append-only, written only by the
-- SECURITY DEFINER trigger below (which bypasses RLS).

-- ---------------------------------------------------------------------------
-- 7) Audit trigger — records important team/billing/invoice actions
-- ---------------------------------------------------------------------------
create or replace function public.audit_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec      record;
  v_org    uuid;
  v_actor  uuid := auth.uid();
  v_action text;
  v_meta   jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  v_org := rec.org_id;

  if tg_table_name = 'memberships' then
    if    tg_op = 'INSERT' then v_action := 'member.added';
    elsif tg_op = 'DELETE' then v_action := 'member.removed';
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then v_action := 'member.role_changed';
    else  v_action := 'member.updated';
    end if;
    v_meta := jsonb_build_object('user_id', rec.user_id, 'role', rec.role);

  elsif tg_table_name = 'invitations' then
    if    tg_op = 'INSERT' then v_action := 'invitation.sent';
    elsif tg_op = 'UPDATE' and new.accepted_at is not null and old.accepted_at is null then v_action := 'invitation.accepted';
    elsif tg_op = 'UPDATE' and new.revoked_at  is not null and old.revoked_at  is null then v_action := 'invitation.revoked';
    else  v_action := 'invitation.updated';
    end if;
    v_meta := jsonb_build_object('email', rec.email, 'role', rec.role);

  elsif tg_table_name = 'subscriptions' then
    v_action := 'subscription.updated';
    v_meta := jsonb_build_object('plan', rec.plan, 'status', rec.status);

  elsif tg_table_name = 'invoices' then
    if tg_op = 'INSERT' then v_action := 'invoice.created'; else v_action := 'invoice.updated'; end if;
    v_meta := jsonb_build_object('number', rec.number, 'status', rec.status, 'total', rec.total);

  else
    v_action := tg_table_name || '.' || lower(tg_op);
  end if;

  insert into public.audit_log (org_id, actor_user_id, action, entity, entity_id, meta)
  values (v_org, v_actor, v_action, tg_table_name, rec.id, v_meta);
  return null;
end $$;

drop trigger if exists trg_audit_memberships  on public.memberships;
create trigger trg_audit_memberships  after insert or update or delete on public.memberships
  for each row execute function public.audit_event();

drop trigger if exists trg_audit_invitations  on public.invitations;
create trigger trg_audit_invitations  after insert or update on public.invitations
  for each row execute function public.audit_event();

drop trigger if exists trg_audit_subscriptions on public.subscriptions;
create trigger trg_audit_subscriptions after update on public.subscriptions
  for each row execute function public.audit_event();

drop trigger if exists trg_audit_invoices     on public.invoices;
create trigger trg_audit_invoices     after insert or update on public.invoices
  for each row execute function public.audit_event();

-- ---------------------------------------------------------------------------
-- 8) Plan-limit enforcement (BEFORE INSERT triggers; SECURITY DEFINER so the
--    count queries see the whole org regardless of the caller's row visibility)
-- ---------------------------------------------------------------------------

-- Free plan: at most 25 customers
create or replace function public.enforce_customer_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_count int;
begin
  select customer_limit into v_limit from public.subscriptions where org_id = new.org_id;
  if v_limit is not null then
    select count(*) into v_count from public.customers where org_id = new.org_id;
    if v_count >= v_limit then
      raise exception 'Customer limit reached for your plan (max %). Upgrade to add more customers.', v_limit
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_customer_limit on public.customers;
create trigger trg_customer_limit before insert on public.customers
  for each row execute function public.enforce_customer_limit();

-- Seat limit: block a new membership beyond the plan's seat count
create or replace function public.enforce_seat_limit_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_count int;
begin
  select seat_limit into v_limit from public.subscriptions where org_id = new.org_id;
  if v_limit is not null then
    select count(*) into v_count from public.memberships
      where org_id = new.org_id and status = 'active' and user_id <> new.user_id;
    if v_count >= v_limit then
      raise exception 'Seat limit reached for your plan (max %). Upgrade to add teammates.', v_limit
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_seat_limit_member on public.memberships;
create trigger trg_seat_limit_member before insert on public.memberships
  for each row execute function public.enforce_seat_limit_member();

-- Seat limit: block a new invitation when members + pending invites are full
create or replace function public.enforce_seat_limit_invite()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_members int; v_pending int;
begin
  select seat_limit into v_limit from public.subscriptions where org_id = new.org_id;
  if v_limit is not null then
    select count(*) into v_members from public.memberships
      where org_id = new.org_id and status = 'active';
    select count(*) into v_pending from public.invitations
      where org_id = new.org_id and accepted_at is null and revoked_at is null and expires_at > now();
    if (v_members + v_pending) >= v_limit then
      raise exception 'Seat limit reached for your plan (max %). Upgrade to invite more teammates.', v_limit
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_seat_limit_invite on public.invitations;
create trigger trg_seat_limit_invite before insert on public.invitations
  for each row execute function public.enforce_seat_limit_invite();

-- ---------------------------------------------------------------------------
-- 9) Owner RPC to change plan (no Stripe — limits re-sync via the trigger)
-- ---------------------------------------------------------------------------
create or replace function public.set_subscription_plan(p_org uuid, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_org_role(p_org) <> 'owner' then
    raise exception 'Only the owner can change the plan.';
  end if;
  if p_plan not in ('free', 'pro', 'team') then
    raise exception 'Unknown plan.';
  end if;
  update public.subscriptions set plan = p_plan::subscription_plan where org_id = p_org;
end $$;

grant execute on function public.set_subscription_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) Signup provisioning — also create a subscription for new (non-invited)
--     shops. Extends the 013 version (keeps invited-skip + profile email).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid;
  v_name text;
  v_plan subscription_plan;
begin
  insert into public.profiles (id, full_name, business_name, email)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'business_name',
          new.email)
  on conflict (id) do update set email = excluded.email;

  if coalesce(new.raw_user_meta_data->>'invited', '') = 'true' then
    return new;
  end if;

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'business_name'), ''),
    nullif(trim(split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1)), '') || '''s Shop',
    'My Shop'
  );

  insert into public.organizations (name, owner_user_id, plan, trial_ends_at)
  values (v_name, new.id, 'trial', now() + interval '14 days')
  returning id into v_org;

  v_plan := coalesce(nullif(new.raw_user_meta_data->>'selected_plan', '')::subscription_plan, 'free');

  insert into public.subscriptions (org_id, plan, status, trial_ends_at, current_period_end)
  values (v_org, v_plan, 'trialing', now() + interval '14 days', now() + interval '14 days');

  insert into public.memberships (org_id, user_id, role, status)
  values (v_org, new.id, 'owner', 'active');

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 11) Backfill — one subscription per existing organization, plan/founding
--     status derived from what signup stored in organizations.settings.
-- ---------------------------------------------------------------------------
insert into public.subscriptions (org_id, plan, status, trial_ends_at, founding_member, current_period_end)
select
  o.id,
  case when o.settings->>'selected_plan' in ('free', 'pro', 'team')
       then (o.settings->>'selected_plan')::subscription_plan
       else 'free'::subscription_plan end,
  case when o.trial_ends_at is not null and o.trial_ends_at > now()
       then 'trialing'::subscription_status
       else 'active'::subscription_status end,
  o.trial_ends_at,
  coalesce((o.settings->>'founding_member')::boolean, false),
  coalesce(o.trial_ends_at, now() + interval '30 days')
from public.organizations o
on conflict (org_id) do nothing;

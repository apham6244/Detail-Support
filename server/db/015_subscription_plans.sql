-- ============================================================================
-- Migration 015 — Detail Support: plan catalog, feature entitlements,
-- effective-plan (trial) logic, and the Founding Member Program.
--
-- Builds on 014 (subscriptions/payments/audit/limits). Adds:
--   • plans / features / plan_features  — the source of truth for pricing and
--     which features each tier unlocks (Free / Pro / Team).
--   • effective_plan()                  — the plan actually in force right now,
--     so a 14-day trial silently reverts to Free the moment it expires, and a
--     canceled/past-due org drops to Free — no cron needed (it's date-driven).
--   • org_has_feature() / org_*_limit() — feature + limit checks driven by the
--     EFFECTIVE plan (used by the enforcement triggers).
--   • Founding Member Program           — first 100 shops get founding status,
--     locked-in pricing, and an early-access flag; granted at signup.
--
-- Additive + idempotent. Run AFTER 010–014. Non-nested dollar quotes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Plan catalog — pricing + limits, one row per tier.
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  plan           text primary key check (plan in ('free', 'pro', 'team')),
  name           text not null,
  monthly_price  numeric(10, 2) not null default 0,
  seat_limit     int not null default 1,
  customer_limit int,                          -- null = unlimited
  sort_order     int not null default 0
);

insert into public.plans (plan, name, monthly_price, seat_limit, customer_limit, sort_order) values
  ('free', 'Free',  0, 1,   25,   0),
  ('pro',  'Pro',   5, 1,   null, 1),
  ('team', 'Team', 15, 10,  null, 2)
on conflict (plan) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  seat_limit = excluded.seat_limit,
  customer_limit = excluded.customer_limit,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 2) Feature catalog + which plan grants which feature.
-- ---------------------------------------------------------------------------
create table if not exists public.features (
  key        text primary key,
  label      text not null,
  sort_order int not null default 0
);

insert into public.features (key, label, sort_order) values
  ('customer_management',  'Customer management',        0),
  ('scheduling',           'Scheduling',                 1),
  ('customer_history',     'Customer history',           2),
  ('vehicle_profiles',     'Vehicle profiles',           3),
  ('quotes',               'Quotes',                     4),
  ('invoices',             'Invoices',                   5),
  ('analytics',            'Analytics',                  6),
  ('marketing',            'Marketing tools',            7),
  ('team_members',         'Multiple employee accounts', 8),
  ('employee_permissions', 'Employee permissions',       9),
  ('job_assignments',      'Job assignments',           10),
  ('team_scheduling',      'Team scheduling',           11),
  ('performance_tracking', 'Performance tracking',      12)
on conflict (key) do update set label = excluded.label, sort_order = excluded.sort_order;

create table if not exists public.plan_features (
  plan        text not null references public.plans(plan) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  primary key (plan, feature_key)
);

-- Rebuild the mapping every run so it always matches this file exactly.
delete from public.plan_features;

-- Free: basic customer management + basic scheduling (customers capped at 25).
insert into public.plan_features (plan, feature_key)
  select 'free', key from public.features
  where key in ('customer_management', 'scheduling');

-- Pro: unlimited customers, history, vehicles, scheduling, quotes, invoices,
--      analytics, marketing.
insert into public.plan_features (plan, feature_key)
  select 'pro', key from public.features
  where key in ('customer_management', 'scheduling', 'customer_history',
                'vehicle_profiles', 'quotes', 'invoices', 'analytics', 'marketing');

-- Team: everything in Pro + all team capabilities (i.e. every feature).
insert into public.plan_features (plan, feature_key)
  select 'team', key from public.features;

-- Catalogs are public, read-only reference data (safe for a pricing page).
alter table public.plans         enable row level security;
alter table public.features      enable row level security;
alter table public.plan_features enable row level security;
drop policy if exists plans_read    on public.plans;
drop policy if exists features_read  on public.features;
drop policy if exists pf_read        on public.plan_features;
create policy plans_read   on public.plans        for select using (true);
create policy features_read on public.features     for select using (true);
create policy pf_read       on public.plan_features for select using (true);
grant select on public.plans, public.features, public.plan_features to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Founding Member Program fields.
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists founding_member_since timestamptz,
  add column if not exists locked_monthly_price  numeric(10, 2);

-- The program is open until 100 shops have founding status.
create or replace function public.founding_program_open()
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from public.subscriptions where founding_member) < 100;
$$;

-- ---------------------------------------------------------------------------
-- 4) Effective plan (trial-aware) + limit / feature helpers.
--    effective_plan is what the org actually gets RIGHT NOW:
--      • active                       → their plan
--      • trialing and trial not over  → their plan
--      • trial expired / past_due / canceled → free
--    Because it compares trial_ends_at to now(), a trial reverts to Free the
--    instant it lapses, with no scheduled job required.
-- ---------------------------------------------------------------------------
create or replace function public.effective_plan(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when s.status = 'active' then s.plan::text
    when s.status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()) then s.plan::text
    else 'free'
  end
  from public.subscriptions s
  where s.org_id = p_org;
$$;

create or replace function public.trial_active(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where org_id = p_org and status = 'trialing'
      and trial_ends_at is not null and trial_ends_at > now()
  );
$$;

create or replace function public.org_seat_limit(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select p.seat_limit from public.plans p where p.plan = public.effective_plan(p_org);
$$;

create or replace function public.org_customer_limit(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select p.customer_limit from public.plans p where p.plan = public.effective_plan(p_org);
$$;

create or replace function public.org_has_feature(p_org uuid, p_feature text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plan_features pf
    where pf.plan = public.effective_plan(p_org) and pf.feature_key = p_feature
  );
$$;

-- Founding members get early access to new features.
create or replace function public.org_has_early_access(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select founding_member from public.subscriptions where org_id = p_org), false);
$$;

-- The monthly price the org actually pays: a founding member's locked-in rate,
-- otherwise the current list price for their plan.
create or replace function public.org_monthly_price(p_org uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.locked_monthly_price from public.subscriptions s
       where s.org_id = p_org and s.founding_member and s.locked_monthly_price is not null),
    (select p.monthly_price from public.plans p
       where p.plan = (select plan::text from public.subscriptions where org_id = p_org))
  );
$$;

grant execute on function public.founding_program_open()          to anon, authenticated;
grant execute on function public.effective_plan(uuid)             to authenticated;
grant execute on function public.trial_active(uuid)               to authenticated;
grant execute on function public.org_seat_limit(uuid)             to authenticated;
grant execute on function public.org_customer_limit(uuid)         to authenticated;
grant execute on function public.org_has_feature(uuid, text)      to authenticated;
grant execute on function public.org_has_early_access(uuid)       to authenticated;
grant execute on function public.org_monthly_price(uuid)          to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Re-point plan-limit enforcement at the EFFECTIVE plan, so an expired
--    trial is actually held to Free limits. (Replaces the 014 bodies; the
--    triggers themselves are unchanged.)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_customer_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_count int;
begin
  v_limit := public.org_customer_limit(new.org_id);
  if v_limit is not null then
    select count(*) into v_count from public.customers where org_id = new.org_id;
    if v_count >= v_limit then
      raise exception 'Customer limit reached for your plan (max %). Upgrade to add more customers.', v_limit
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create or replace function public.enforce_seat_limit_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_count int;
begin
  v_limit := public.org_seat_limit(new.org_id);
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

create or replace function public.enforce_seat_limit_invite()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_members int; v_pending int;
begin
  v_limit := public.org_seat_limit(new.org_id);
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

-- ---------------------------------------------------------------------------
-- 6) set_subscription_plan — keep the founding rate locked across plan changes.
-- ---------------------------------------------------------------------------
create or replace function public.set_subscription_plan(p_org uuid, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare v_founding boolean; v_price numeric;
begin
  if public.current_org_role(p_org) <> 'owner' then
    raise exception 'Only the owner can change the plan.';
  end if;
  if p_plan not in ('free', 'pro', 'team') then
    raise exception 'Unknown plan.';
  end if;

  select founding_member into v_founding from public.subscriptions where org_id = p_org;
  select monthly_price into v_price from public.plans where plan = p_plan;

  update public.subscriptions
     set plan = p_plan::subscription_plan,
         -- founding members re-lock at the new plan's current (founding) rate
         locked_monthly_price = case when v_founding then v_price else locked_monthly_price end
   where org_id = p_org;
end $$;

grant execute on function public.set_subscription_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Signup provisioning — grant Founding Member status (while the program is
--    open), record the locked price + 14-day trial. Extends the 014 version.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org      uuid;
  v_name     text;
  v_plan     subscription_plan;
  v_founding boolean;
  v_price    numeric;
begin
  insert into public.profiles (id, full_name, business_name, email)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'business_name',
          new.email)
  on conflict (id) do update set email = excluded.email;

  if coalesce(new.raw_user_meta_data->>'invited', '') = 'true' then
    return new;  -- invited teammates join an existing shop; no new workspace
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
  v_founding := public.founding_program_open();
  select monthly_price into v_price from public.plans where plan = v_plan::text;

  insert into public.subscriptions
    (org_id, plan, status, trial_ends_at, current_period_end,
     founding_member, founding_member_since, locked_monthly_price)
  values
    (v_org, v_plan, 'trialing', now() + interval '14 days', now() + interval '14 days',
     v_founding,
     case when v_founding then now() else null end,
     case when v_founding then v_price else null end);

  insert into public.memberships (org_id, user_id, role, status)
  values (v_org, new.id, 'owner', 'active');

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 8) Backfill founding fields for shops that already hold founding status.
-- ---------------------------------------------------------------------------
update public.subscriptions s
set founding_member_since = coalesce(s.founding_member_since, s.created_at),
    locked_monthly_price  = coalesce(s.locked_monthly_price, p.monthly_price)
from public.plans p
where p.plan = s.plan::text and s.founding_member;

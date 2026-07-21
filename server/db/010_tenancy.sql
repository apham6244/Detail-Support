-- ============================================================================
-- Migration 010 — Detail Support: multi-tenancy foundation (Phase 0)
-- Self-contained: run this on the Supabase SQL editor. Safe to run after the
-- existing schema, or on its own. Additive + idempotent (no drops of data).
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type org_plan      as enum ('trial', 'pro', 'team');
  create type member_role   as enum ('owner', 'manager', 'technician');
  create type member_status as enum ('active', 'invited');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles (created here if the base schema wasn't run)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  business_name text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- organizations = one detailing shop (the tenant)
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan          org_plan not null default 'trial',
  trial_ends_at timestamptz,
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- memberships = user ↔ org link, with role (this is "Teams")
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       member_role not null default 'owner',
  status     member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_org  on public.memberships(org_id);

-- ---------------------------------------------------------------------------
-- invitations (defined now; used in Phase 3)
-- ---------------------------------------------------------------------------
create table if not exists public.invitations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  email      citext not null,
  role       member_role not null default 'technician',
  token      text not null unique default encode(gen_random_bytes(16), 'hex'),
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Membership helpers — SECURITY DEFINER so they bypass RLS internally and
-- don't recurse when used inside the memberships policy.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.current_org_role(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.memberships
  where org_id = p_org and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security — membership-based (replaces owner_id = auth.uid()).
-- Read: any active member. Write: owner/manager.
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
drop policy if exists org_read  on public.organizations;
drop policy if exists org_write on public.organizations;
create policy org_read  on public.organizations for select
  using (public.is_org_member(id));
create policy org_write on public.organizations for update
  using (public.current_org_role(id) in ('owner', 'manager'))
  with check (public.current_org_role(id) in ('owner', 'manager'));

alter table public.memberships enable row level security;
drop policy if exists mem_read  on public.memberships;
drop policy if exists mem_write on public.memberships;
create policy mem_read  on public.memberships for select
  using (public.is_org_member(org_id));
create policy mem_write on public.memberships for all
  using (public.current_org_role(org_id) in ('owner', 'manager'))
  with check (public.current_org_role(org_id) in ('owner', 'manager'));

alter table public.invitations enable row level security;
drop policy if exists inv_all on public.invitations;
create policy inv_all on public.invitations for all
  using (public.current_org_role(org_id) in ('owner', 'manager'))
  with check (public.current_org_role(org_id) in ('owner', 'manager'));

-- profiles: a user sees/edits only their own row.
alter table public.profiles enable row level security;
drop policy if exists profile_self on public.profiles;
create policy profile_self on public.profiles
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_organizations on public.organizations;
create trigger trg_touch_organizations before update on public.organizations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Signup provisioning — one signup → profile + organization + owner membership,
-- atomically. SECURITY DEFINER so the inserts bypass RLS.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid;
  v_name text;
begin
  insert into public.profiles (id, full_name, business_name)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'business_name')
  on conflict (id) do nothing;

  -- Shop name: the signup "business_name", else "<First>'s Shop", else "My Shop".
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'business_name'), ''),
    nullif(trim(split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1)), '') || '''s Shop',
    'My Shop'
  );

  insert into public.organizations (name, owner_user_id, plan, trial_ends_at)
  values (v_name, new.id, 'trial', now() + interval '14 days')
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role, status)
  values (v_org, new.id, 'owner', 'active');

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill — give any existing auth user (e.g. your earlier test signups) an
-- organization + owner membership so nothing is left orphaned.
-- ---------------------------------------------------------------------------
do $$
declare u record; v_org uuid;
begin
  for u in
    select id, raw_user_meta_data
    from auth.users
    where id not in (select user_id from public.memberships)
  loop
    insert into public.profiles (id, full_name, business_name)
    values (u.id, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'business_name')
    on conflict (id) do nothing;

    insert into public.organizations (name, owner_user_id, plan, trial_ends_at)
    values (coalesce(nullif(trim(u.raw_user_meta_data->>'business_name'), ''), 'My Shop'),
            u.id, 'trial', now() + interval '14 days')
    returning id into v_org;

    insert into public.memberships (org_id, user_id, role, status)
    values (v_org, u.id, 'owner', 'active');
  end loop;
end $$;

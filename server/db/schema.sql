-- ============================================================================
-- Amei Auto Detailz — Outreach CRM :: Database schema (Supabase / PostgreSQL)
-- ============================================================================
-- Run this in the Supabase SQL editor (or via the CLI) on a fresh project.
-- Design goals:
--   * Single-tenant-per-user isolation enforced by Row-Level Security (RLS).
--   * Every domain row carries owner_id -> auth.users(id) so RLS is uniform.
--   * Indexed for thousands of leads / hundreds of thousands of email events.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- case-insensitive email

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role       as enum ('owner', 'staff');
  create type business_category as enum ('luxury_dealer','dealership','exotic_rental','auto_service');
  create type lead_status      as enum ('new','contacted','interested','customer','not_interested');
  create type lead_source      as enum ('manual','csv_import','google_places');
  create type campaign_status  as enum ('draft','scheduled','sending','sent','paused');
  create type send_status      as enum ('pending','sent','failed','bounced','skipped');
  create type email_event_type as enum ('delivered','opened','clicked','bounced','unsubscribed','replied');
  create type followup_status  as enum ('pending','done','snoozed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users — the "Users" table for app-level data)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  business_name text,
  avatar_url    text,
  role          user_role not null default 'owner',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, business_name)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'business_name')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  category        business_category not null default 'dealership',
  website         text,
  phone           text,
  address         text,
  city            text,
  state           text default 'TX',
  zip             text,
  google_place_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Prevent re-importing the same Google Places business for one account.
  unique (owner_id, google_place_id)
);

-- ---------------------------------------------------------------------------
-- contacts  (people at a business)
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  first_name  text,
  last_name   text,
  email       citext,
  phone       text,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- leads  (the outreach pipeline entry)
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  business_id      uuid references public.businesses(id) on delete set null,
  contact_id       uuid references public.contacts(id) on delete set null,
  status           lead_status not null default 'new',
  source           lead_source not null default 'manual',
  tags             text[] not null default '{}',
  notes            text,
  last_contacted_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- email_templates
-- ---------------------------------------------------------------------------
create table if not exists public.email_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  subject    text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  template_id  uuid references public.email_templates(id) on delete set null,
  status       campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- campaign_recipients  (which leads a campaign targets)
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_recipients (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  lead_id             uuid not null references public.leads(id) on delete cascade,
  send_status         send_status not null default 'pending',
  provider_message_id text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

-- ---------------------------------------------------------------------------
-- sent_emails  (per-email send log)
-- ---------------------------------------------------------------------------
create table if not exists public.sent_emails (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  campaign_id         uuid references public.campaigns(id) on delete set null,
  lead_id             uuid references public.leads(id) on delete set null,
  to_email            citext not null,
  subject             text not null,
  status              send_status not null default 'sent',
  provider_message_id text,
  sent_at             timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- email_events  (opens / clicks / bounces — feeds Analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.email_events (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  sent_email_id uuid not null references public.sent_emails(id) on delete cascade,
  type          email_event_type not null,
  metadata      jsonb not null default '{}',
  occurred_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- follow_ups
-- ---------------------------------------------------------------------------
create table if not exists public.follow_ups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  lead_id    uuid not null references public.leads(id) on delete cascade,
  due_at     timestamptz not null,
  status     followup_status not null default 'pending',
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- suppressions  (global opt-out list — checked before every send)
-- ---------------------------------------------------------------------------
create table if not exists public.suppressions (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  email      citext not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (owner_id, email)
);

-- ---------------------------------------------------------------------------
-- Indexes (scale: thousands of leads, many events)
-- ---------------------------------------------------------------------------
create index if not exists idx_businesses_owner       on public.businesses(owner_id);
create index if not exists idx_businesses_city         on public.businesses(owner_id, city);
create index if not exists idx_contacts_owner          on public.contacts(owner_id);
create index if not exists idx_contacts_business       on public.contacts(business_id);
create index if not exists idx_leads_owner_status      on public.leads(owner_id, status);
create index if not exists idx_leads_business          on public.leads(business_id);
create index if not exists idx_leads_tags              on public.leads using gin(tags);
create index if not exists idx_templates_owner         on public.email_templates(owner_id);
create index if not exists idx_campaigns_owner_status  on public.campaigns(owner_id, status);
create index if not exists idx_recipients_campaign     on public.campaign_recipients(campaign_id);
create index if not exists idx_recipients_lead         on public.campaign_recipients(lead_id);
create index if not exists idx_sent_owner_campaign     on public.sent_emails(owner_id, campaign_id);
create index if not exists idx_events_sent             on public.email_events(sent_email_id);
create index if not exists idx_events_owner_type       on public.email_events(owner_id, type);
create index if not exists idx_followups_owner_due     on public.follow_ups(owner_id, due_at) where status = 'pending';
create index if not exists idx_suppressions_owner_email on public.suppressions(owner_id, email);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','businesses','contacts','leads',
                           'email_templates','campaigns','follow_ups']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s;', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row-Level Security — the real isolation boundary.
-- Every table: a user may only touch rows where owner_id = auth.uid().
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['businesses','contacts','leads','email_templates',
                           'campaigns','campaign_recipients','sent_emails',
                           'email_events','follow_ups','suppressions']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists owner_all on public.%I;', t);
    execute format($p$create policy owner_all on public.%I
                       using (owner_id = auth.uid())
                       with check (owner_id = auth.uid());$p$, t);
  end loop;
end $$;

-- profiles: a user may only see / edit their own profile row.
alter table public.profiles enable row level security;
drop policy if exists profile_self on public.profiles;
create policy profile_self on public.profiles
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Analytics view — per-campaign aggregate stats (open/click/reply rates)
-- ---------------------------------------------------------------------------
create or replace view public.analytics_campaign_stats
with (security_invoker = true) as
select
  c.id                                                          as campaign_id,
  c.owner_id,
  c.name,
  c.status,
  count(distinct se.id)                                         as sent,
  count(distinct ev.id) filter (where ev.type = 'delivered')   as delivered,
  count(distinct ev.id) filter (where ev.type = 'opened')      as opened,
  count(distinct ev.id) filter (where ev.type = 'clicked')     as clicked,
  count(distinct ev.id) filter (where ev.type = 'replied')     as replied,
  count(distinct ev.id) filter (where ev.type = 'bounced')     as bounced
from public.campaigns c
left join public.sent_emails  se on se.campaign_id = c.id
left join public.email_events ev on ev.sent_email_id = se.id
group by c.id;

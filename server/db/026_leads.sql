-- ============================================================================
-- Migration 026 — Detail Support: Leads (lightweight pre-customer CRM)
-- Org-scoped, RLS by membership (read/insert/update = any active member;
-- delete = owner/manager), matching migration 011. Uses text + CHECK for
-- status/source (no enum-name collisions with the legacy CRM dropped in 019).
--
-- Self-contained + idempotent. Run on the Supabase SQL editor AFTER 010–011
-- (needs organizations, customers + is_org_member / current_org_role /
-- touch_updated_at) and AFTER 019 (which dropped the legacy `leads` /
-- `lead_activities` tables, freeing these names).
--
-- NOTE: Reviews are deliberately NOT a table. The Reviews page reads live from
-- the shop's connected Google Business Profile (the connection is stored in
-- organizations.settings.google_business) — there is no local review store and
-- no manual review entry. If you ran an earlier draft of this migration that
-- created public.reviews, it is now unused and safe to drop:
--     drop table if exists public.reviews;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  name                  text not null,
  phone                 text,
  email                 citext,
  vehicle               text,               -- free text, e.g. "2021 Tesla Model 3"
  service               text,               -- requested service
  estimated_value       numeric(10, 2),
  source                text,               -- facebook | instagram | google | referral | website | walk_in | other
  status                text not null default 'new'
                          check (status in ('new', 'contacted', 'quote_sent', 'scheduled', 'won', 'lost')),
  notes                 text,
  last_contacted_at     timestamptz,
  converted_customer_id uuid references public.customers(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_leads_org    on public.leads(org_id, created_at desc);
create index if not exists idx_leads_status on public.leads(org_id, status);

drop trigger if exists trg_touch_leads on public.leads;
create trigger trg_touch_leads before update on public.leads
  for each row execute function public.touch_updated_at();

alter table public.leads enable row level security;
drop policy if exists member_read    on public.leads;
drop policy if exists member_insert  on public.leads;
drop policy if exists member_update  on public.leads;
drop policy if exists manager_delete on public.leads;
create policy member_read    on public.leads for select using (public.is_org_member(org_id));
create policy member_insert  on public.leads for insert with check (public.is_org_member(org_id));
create policy member_update  on public.leads for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy manager_delete on public.leads for delete using (public.current_org_role(org_id) in ('owner', 'manager'));

-- ---------------------------------------------------------------------------
-- lead_activities — notes + a simple activity timeline per lead
-- (fresh, org-scoped table — the legacy owner_id version was dropped by 019)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_activities (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  lead_id    uuid not null references public.leads(id) on delete cascade,
  type       text not null default 'note',  -- note | status_change | contacted | created | converted
  body       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_activities_lead on public.lead_activities(lead_id, created_at desc);

alter table public.lead_activities enable row level security;
drop policy if exists member_read    on public.lead_activities;
drop policy if exists member_insert  on public.lead_activities;
drop policy if exists manager_delete on public.lead_activities;
create policy member_read    on public.lead_activities for select using (public.is_org_member(org_id));
create policy member_insert  on public.lead_activities for insert with check (public.is_org_member(org_id));
create policy manager_delete on public.lead_activities for delete using (public.current_org_role(org_id) in ('owner', 'manager'));

-- ============================================================================
-- Migration 011 — Detail Support Phase 1: operational core
-- Customers, Vehicles, Services (catalog), Appointments. Org-scoped, RLS by
-- membership. Run AFTER 010_tenancy.sql.
--
-- NOTE: written with explicit statements (no nested dollar-quoting) so it runs
-- cleanly in the Supabase SQL editor.
-- ============================================================================

do $$ begin
  create type appointment_status as enum
    ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  email      citext,
  phone      text,
  address    text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_org on public.customers(org_id);

create table if not exists public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  year          int,
  make          text,
  model         text,
  color         text,
  license_plate text,
  vin           text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_vehicles_org      on public.vehicles(org_id);
create index if not exists idx_vehicles_customer on public.vehicles(customer_id);

create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  description  text,
  price        numeric(10, 2) not null default 0,
  duration_min int not null default 60,
  category     text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_services_org on public.services(org_id);

create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  vehicle_id   uuid references public.vehicles(id) on delete set null,
  service_id   uuid references public.services(id) on delete set null,
  assigned_to  uuid references auth.users(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_min int not null default 60,
  status       appointment_status not null default 'scheduled',
  price        numeric(10, 2),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_appointments_org_time on public.appointments(org_id, scheduled_at);
create index if not exists idx_appointments_status   on public.appointments(org_id, status);
create index if not exists idx_appointments_customer on public.appointments(customer_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (uses public.touch_updated_at from migration 010)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_touch_customers on public.customers;
create trigger trg_touch_customers before update on public.customers
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_vehicles on public.vehicles;
create trigger trg_touch_vehicles before update on public.vehicles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_services on public.services;
create trigger trg_touch_services before update on public.services
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_appointments on public.appointments;
create trigger trg_touch_appointments before update on public.appointments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — read/insert/update by any active member; delete by owner/manager.
-- (uses public.is_org_member / public.current_org_role from migration 010)
-- ---------------------------------------------------------------------------

-- customers
alter table public.customers enable row level security;
drop policy if exists member_read    on public.customers;
drop policy if exists member_insert   on public.customers;
drop policy if exists member_update   on public.customers;
drop policy if exists manager_delete  on public.customers;
create policy member_read   on public.customers for select using (public.is_org_member(org_id));
create policy member_insert on public.customers for insert with check (public.is_org_member(org_id));
create policy member_update on public.customers for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy manager_delete on public.customers for delete using (public.current_org_role(org_id) in ('owner', 'manager'));

-- vehicles
alter table public.vehicles enable row level security;
drop policy if exists member_read    on public.vehicles;
drop policy if exists member_insert   on public.vehicles;
drop policy if exists member_update   on public.vehicles;
drop policy if exists manager_delete  on public.vehicles;
create policy member_read   on public.vehicles for select using (public.is_org_member(org_id));
create policy member_insert on public.vehicles for insert with check (public.is_org_member(org_id));
create policy member_update on public.vehicles for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy manager_delete on public.vehicles for delete using (public.current_org_role(org_id) in ('owner', 'manager'));

-- services
alter table public.services enable row level security;
drop policy if exists member_read    on public.services;
drop policy if exists member_insert   on public.services;
drop policy if exists member_update   on public.services;
drop policy if exists manager_delete  on public.services;
create policy member_read   on public.services for select using (public.is_org_member(org_id));
create policy member_insert on public.services for insert with check (public.is_org_member(org_id));
create policy member_update on public.services for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy manager_delete on public.services for delete using (public.current_org_role(org_id) in ('owner', 'manager'));

-- appointments
alter table public.appointments enable row level security;
drop policy if exists member_read    on public.appointments;
drop policy if exists member_insert   on public.appointments;
drop policy if exists member_update   on public.appointments;
drop policy if exists manager_delete  on public.appointments;
create policy member_read   on public.appointments for select using (public.is_org_member(org_id));
create policy member_insert on public.appointments for insert with check (public.is_org_member(org_id));
create policy member_update on public.appointments for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy manager_delete on public.appointments for delete using (public.current_org_role(org_id) in ('owner', 'manager'));

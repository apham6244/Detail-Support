-- ============================================================================
-- Migration 012 — Detail Support Phase 2: invoices (track / mark-paid model)
-- No payment processing — you record how the customer paid (cash, Zelle, etc.)
-- and mark the status. Run AFTER 011_operations.sql.
--
-- NOTE: written with explicit statements (no nested dollar-quoting) so it runs
-- cleanly in the Supabase SQL editor.
-- ============================================================================

do $$ begin
  create type invoice_status as enum ('unpaid', 'deposit_paid', 'balance_due', 'paid');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  customer_id    uuid not null references public.customers(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  number         text,
  status         invoice_status not null default 'unpaid',
  subtotal       numeric(10, 2) not null default 0,
  tax            numeric(10, 2) not null default 0,
  total          numeric(10, 2) not null default 0,
  deposit_amount numeric(10, 2) not null default 0,
  notes          text,
  issued_at      timestamptz not null default now(),
  due_at         timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_invoices_org_status on public.invoices(org_id, status);
create index if not exists idx_invoices_customer   on public.invoices(customer_id);

create table if not exists public.invoice_line_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity    numeric(10, 2) not null default 1,
  unit_price  numeric(10, 2) not null default 0,
  amount      numeric(10, 2) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_line_items_invoice on public.invoice_line_items(invoice_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (uses public.touch_updated_at from migration 010)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_touch_invoices on public.invoices;
create trigger trg_touch_invoices before update on public.invoices
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (same membership model as Phase 1)
-- ---------------------------------------------------------------------------

-- invoices
alter table public.invoices enable row level security;
drop policy if exists member_read    on public.invoices;
drop policy if exists member_insert   on public.invoices;
drop policy if exists member_update   on public.invoices;
drop policy if exists manager_delete  on public.invoices;
create policy member_read   on public.invoices for select using (public.is_org_member(org_id));
create policy member_insert on public.invoices for insert with check (public.is_org_member(org_id));
create policy member_update on public.invoices for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy manager_delete on public.invoices for delete using (public.current_org_role(org_id) in ('owner', 'manager'));

-- invoice_line_items
alter table public.invoice_line_items enable row level security;
drop policy if exists member_read    on public.invoice_line_items;
drop policy if exists member_insert   on public.invoice_line_items;
drop policy if exists member_update   on public.invoice_line_items;
drop policy if exists manager_delete  on public.invoice_line_items;
create policy member_read   on public.invoice_line_items for select using (public.is_org_member(org_id));
create policy member_insert on public.invoice_line_items for insert with check (public.is_org_member(org_id));
create policy member_update on public.invoice_line_items for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy manager_delete on public.invoice_line_items for delete using (public.current_org_role(org_id) in ('owner', 'manager'));

-- ============================================================================
-- Migration 016 — Detail Support: Quotes (a Pro-plan feature)
--
-- Quotes are estimates a shop sends a customer. They mirror the invoices model
-- (012): org-scoped, owner/admin RLS, line items, and a running total. An
-- accepted quote can be converted — without re-typing anything — into an
-- invoice and/or an appointment via SECURITY DEFINER RPCs that copy the data
-- and link back (so a quote converts at most once).
--
-- The 'quotes' feature flag already exists in plan_features (015: Pro + Team),
-- so no catalog change is needed. Run AFTER 010–015. Additive + idempotent.
-- ============================================================================

do $$ begin
  create type quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  customer_id              uuid not null references public.customers(id) on delete cascade,
  vehicle_id               uuid references public.vehicles(id) on delete set null,
  number                   text,
  status                   quote_status not null default 'draft',
  subtotal                 numeric(10, 2) not null default 0,
  discount                 numeric(10, 2) not null default 0,
  tax                      numeric(10, 2) not null default 0,
  total                    numeric(10, 2) not null default 0,
  notes                    text,
  valid_until              timestamptz,
  sent_at                  timestamptz,
  accepted_at              timestamptz,
  declined_at              timestamptz,
  converted_invoice_id     uuid references public.invoices(id) on delete set null,
  converted_appointment_id uuid references public.appointments(id) on delete set null,
  issued_at                timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_quotes_org_status on public.quotes(org_id, status);
create index if not exists idx_quotes_customer   on public.quotes(customer_id);

create table if not exists public.quote_line_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  quote_id    uuid not null references public.quotes(id) on delete cascade,
  service_id  uuid references public.services(id) on delete set null,
  description text not null,
  quantity    numeric(10, 2) not null default 1,
  unit_price  numeric(10, 2) not null default 0,
  amount      numeric(10, 2) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_quote_lines_quote on public.quote_line_items(quote_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists trg_touch_quotes on public.quotes;
create trigger trg_touch_quotes before update on public.quotes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — owner/admin only (same as invoices; billing/sales artifact)
-- ---------------------------------------------------------------------------
alter table public.quotes enable row level security;
drop policy if exists quotes_admin_all on public.quotes;
create policy quotes_admin_all on public.quotes for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

alter table public.quote_line_items enable row level security;
drop policy if exists quote_lines_admin_all on public.quote_line_items;
create policy quote_lines_admin_all on public.quote_line_items for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- Audit — extend audit_event() with a quotes branch, keep all prior branches.
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

  elsif tg_table_name = 'quotes' then
    if    tg_op = 'INSERT' then v_action := 'quote.created';
    elsif new.status is distinct from old.status and new.status = 'sent'     then v_action := 'quote.sent';
    elsif new.status is distinct from old.status and new.status = 'accepted' then v_action := 'quote.accepted';
    elsif new.status is distinct from old.status and new.status = 'declined' then v_action := 'quote.declined';
    elsif (new.converted_invoice_id     is not null and old.converted_invoice_id     is null)
       or (new.converted_appointment_id is not null and old.converted_appointment_id is null) then v_action := 'quote.converted';
    else  v_action := 'quote.updated';
    end if;
    v_meta := jsonb_build_object('number', rec.number, 'status', rec.status, 'total', rec.total);

  else
    v_action := tg_table_name || '.' || lower(tg_op);
  end if;

  insert into public.audit_log (org_id, actor_user_id, action, entity, entity_id, meta)
  values (v_org, v_actor, v_action, tg_table_name, rec.id, v_meta);
  return null;
end $$;

drop trigger if exists trg_audit_quotes on public.quotes;
create trigger trg_audit_quotes after insert or update on public.quotes
  for each row execute function public.audit_event();

-- ---------------------------------------------------------------------------
-- Conversion RPCs — copy a quote into an invoice / appointment, link back,
-- and refuse a second conversion. SECURITY DEFINER + admin check.
-- ---------------------------------------------------------------------------
create or replace function public.convert_quote_to_invoice(p_quote uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare q public.quotes; v_inv uuid; v_num text;
begin
  select * into q from public.quotes where id = p_quote;
  if not found then raise exception 'Quote not found.'; end if;
  if not public.is_org_admin(q.org_id) then raise exception 'Only owners and admins can convert quotes.'; end if;
  if q.converted_invoice_id is not null then raise exception 'This quote is already linked to an invoice.'; end if;

  select 'INV-' || lpad((count(*) + 1)::text, 4, '0') into v_num
    from public.invoices where org_id = q.org_id;

  insert into public.invoices (org_id, customer_id, number, status, subtotal, tax, total, deposit_amount, notes)
    values (q.org_id, q.customer_id, v_num, 'unpaid', q.subtotal - q.discount, q.tax, q.total, 0, q.notes)
    returning id into v_inv;

  insert into public.invoice_line_items (org_id, invoice_id, description, quantity, unit_price, amount)
    select org_id, v_inv, description, quantity, unit_price, amount
    from public.quote_line_items where quote_id = q.id;

  if q.discount > 0 then
    insert into public.invoice_line_items (org_id, invoice_id, description, quantity, unit_price, amount)
      values (q.org_id, v_inv, 'Discount', 1, -q.discount, -q.discount);
  end if;

  update public.quotes set converted_invoice_id = v_inv where id = q.id;
  return v_inv;
end $$;

create or replace function public.convert_quote_to_appointment(p_quote uuid, p_scheduled_at timestamptz, p_duration int)
returns uuid language plpgsql security definer set search_path = public as $$
declare q public.quotes; v_appt uuid; v_service uuid;
begin
  select * into q from public.quotes where id = p_quote;
  if not found then raise exception 'Quote not found.'; end if;
  if not public.is_org_admin(q.org_id) then raise exception 'Only owners and admins can convert quotes.'; end if;
  if q.converted_appointment_id is not null then raise exception 'This quote is already linked to an appointment.'; end if;

  select service_id into v_service from public.quote_line_items
    where quote_id = q.id and service_id is not null order by created_at limit 1;

  insert into public.appointments (org_id, customer_id, vehicle_id, service_id, scheduled_at, duration_min, status, price, notes)
    values (q.org_id, q.customer_id, q.vehicle_id, v_service, p_scheduled_at, coalesce(p_duration, 60),
            'scheduled', q.total, coalesce(nullif(q.notes, ''), 'From quote ' || q.number))
    returning id into v_appt;

  update public.quotes set converted_appointment_id = v_appt where id = q.id;
  return v_appt;
end $$;

grant execute on function public.convert_quote_to_invoice(uuid)                       to authenticated;
grant execute on function public.convert_quote_to_appointment(uuid, timestamptz, int) to authenticated;

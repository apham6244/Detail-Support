-- ============================================================================
-- Migration 021 — Customer reminders for appointments
--
-- The appointment model already covers customer/vehicle/service/date/time/
-- price/status/notes (011), and appointment_status already has every status
-- (scheduled, confirmed, in_progress, completed, cancelled, no_show). Calendar
-- views are pure UI. The missing piece is REMINDERS.
--
-- A reminder is "nudge this customer at this time about this job". Delivery
-- (email/SMS) is not wired yet — the same pluggable gap as invites/campaigns —
-- so the app surfaces what's due, renders the message, and records the send.
--
-- Access: owners/admins, plus the detailer actually assigned to that job (so
-- they can nudge their own customer). Mirrors the 017 assignment model.
--
-- Run AFTER 010–018 (020 optional). Additive + idempotent.
-- ============================================================================

do $$ begin
  create type reminder_status as enum ('pending', 'sent', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.appointment_reminders (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  remind_at      timestamptz not null,
  channel        text not null default 'sms',
  status         reminder_status not null default 'pending',
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_reminders_due  on public.appointment_reminders(org_id, remind_at);
create index if not exists idx_reminders_appt on public.appointment_reminders(appointment_id);

-- Is the caller the detailer assigned to this job? SECURITY DEFINER so it can
-- read appointments without tripping their RLS.
create or replace function public.appointment_is_mine(p_appt uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.appointments
    where id = p_appt and assigned_to = auth.uid()
  );
$$;
grant execute on function public.appointment_is_mine(uuid) to authenticated;

alter table public.appointment_reminders enable row level security;
drop policy if exists reminders_all on public.appointment_reminders;
create policy reminders_all on public.appointment_reminders for all
  using (public.is_org_admin(org_id) or public.appointment_is_mine(appointment_id))
  with check (public.is_org_admin(org_id) or public.appointment_is_mine(appointment_id));

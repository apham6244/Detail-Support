-- ============================================================================
-- Migration 002 — Lead activities (notes + communication history timeline)
-- Run AFTER schema.sql. Additive; safe to run once on an existing database.
-- ============================================================================

do $$ begin
  create type activity_type as enum (
    'note',            -- a note you wrote
    'call',            -- logged phone call
    'meeting',         -- logged meeting / visit
    'email_manual',    -- an email you sent outside a campaign
    'status_change',   -- lead status moved (auto)
    'email_sent',      -- outreach email sent (auto)
    'email_opened',    -- recipient opened (auto)
    'email_replied',   -- recipient replied (auto)
    'email_bounced',   -- email bounced (auto)
    'imported'         -- created via CSV import (auto)
  );
exception when duplicate_object then null; end $$;

create table if not exists public.lead_activities (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  lead_id    uuid not null references public.leads(id) on delete cascade,
  type       activity_type not null,
  body       text,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_lead
  on public.lead_activities(owner_id, lead_id, created_at desc);

alter table public.lead_activities enable row level security;
drop policy if exists owner_all on public.lead_activities;
create policy owner_all on public.lead_activities
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Auto-log: lead status changes
-- ---------------------------------------------------------------------------
create or replace function public.log_lead_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_activities (owner_id, lead_id, type, body, metadata)
    values (new.owner_id, new.id, 'status_change',
            format('Status changed from %s to %s', old.status, new.status),
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;

drop trigger if exists trg_lead_status on public.leads;
create trigger trg_lead_status
  after update on public.leads
  for each row execute function public.log_lead_status_change();

-- ---------------------------------------------------------------------------
-- Auto-log: an outreach email was sent
-- ---------------------------------------------------------------------------
create or replace function public.log_email_sent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null then
    insert into public.lead_activities (owner_id, lead_id, type, body, metadata)
    values (new.owner_id, new.lead_id, 'email_sent',
            format('Sent “%s” to %s', new.subject, new.to_email),
            jsonb_build_object('sent_email_id', new.id, 'to', new.to_email));
  end if;
  return new;
end $$;

drop trigger if exists trg_email_sent on public.sent_emails;
create trigger trg_email_sent
  after insert on public.sent_emails
  for each row execute function public.log_email_sent();

-- ---------------------------------------------------------------------------
-- Auto-log: open / reply / bounce events (resolves lead via sent_emails)
-- ---------------------------------------------------------------------------
create or replace function public.log_email_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lead uuid;
  v_type activity_type;
begin
  v_type := case new.type
              when 'opened'  then 'email_opened'
              when 'replied' then 'email_replied'
              when 'bounced' then 'email_bounced'
              else null
            end;
  if v_type is null then return new; end if;

  select lead_id into v_lead from public.sent_emails where id = new.sent_email_id;
  if v_lead is not null then
    insert into public.lead_activities (owner_id, lead_id, type, metadata)
    values (new.owner_id, v_lead, v_type,
            jsonb_build_object('sent_email_id', new.sent_email_id));
  end if;
  return new;
end $$;

drop trigger if exists trg_email_event on public.email_events;
create trigger trg_email_event
  after insert on public.email_events
  for each row execute function public.log_email_event();

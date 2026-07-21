-- ============================================================================
-- Migration 018 — Detail Support: Marketing campaigns (a Pro-plan feature)
--
-- IMPORTANT — why this uses `marketing_campaigns` and not `campaigns`:
-- this database still contains the ORIGINAL outreach-CRM schema (schema.sql),
-- which already defines:
--   • public.campaigns  (owner_id, name, template_id, status, scheduled_at …)
--   • the campaign_status enum ('draft','scheduled','sending','sent','paused')
--   • plus leads / email_templates / campaign_recipients
-- An earlier draft of this migration used those names; `create table if not
-- exists` silently skipped the legacy table and the org_id index then failed
-- with 42703. This version claims its own names and leaves every legacy object
-- untouched.
--
-- A campaign targets a live customer segment (all / new / repeat / lapsed),
-- carries a personalised message, and records when it was sent and to how many
-- people. Segments are computed from real customer + appointment data at
-- preview time, so a campaign never stores a stale recipient list.
--
-- Delivery (email/SMS) is not wired — the UI previews/exports the recipient
-- list and records the send.
--
-- The 'marketing' feature flag already exists in plan_features (015: Pro+Team).
-- Performance tracking needs no schema (it derives from appointments).
-- Run AFTER 010–017. Additive + idempotent. Touches no legacy CRM object.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Undo any artifacts a failed earlier run of this migration may have left
--    on the LEGACY campaigns table. These names are ours alone — the original
--    schema.sql defines no triggers/policies on public.campaigns (only the
--    index idx_campaigns_owner_status, which we never touch).
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'campaigns') then
    drop trigger if exists trg_touch_campaigns on public.campaigns;
    drop trigger if exists trg_audit_campaigns on public.campaigns;
    drop policy  if exists campaigns_admin_all on public.campaigns;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Our own status enum (the legacy campaign_status is a different type).
-- ---------------------------------------------------------------------------
do $$ begin
  create type marketing_campaign_status as enum ('draft', 'sent');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2) marketing_campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_campaigns (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  segment         text not null default 'all',
  channel         text not null default 'email',
  subject         text,
  message         text not null default '',
  status          marketing_campaign_status not null default 'draft',
  recipient_count int not null default 0,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_marketing_campaigns_org
  on public.marketing_campaigns(org_id, created_at desc);

drop trigger if exists trg_touch_marketing_campaigns on public.marketing_campaigns;
create trigger trg_touch_marketing_campaigns before update on public.marketing_campaigns
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3) RLS — owner/admin only (marketing is a management surface, like invoices).
-- ---------------------------------------------------------------------------
alter table public.marketing_campaigns enable row level security;
drop policy if exists marketing_campaigns_admin_all on public.marketing_campaigns;
create policy marketing_campaigns_admin_all on public.marketing_campaigns for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- 4) Audit — add a marketing_campaigns branch, keeping every 010–017 branch
--    exactly as it is today (memberships, invitations, subscriptions,
--    invoices, quotes, appointments).
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

  elsif tg_table_name = 'appointments' then
    if    tg_op = 'INSERT' then v_action := 'appointment.created';
    elsif new.assigned_to is distinct from old.assigned_to then v_action := 'appointment.assigned';
    elsif new.status      is distinct from old.status      then v_action := 'appointment.status_changed';
    else  v_action := 'appointment.updated';
    end if;
    v_meta := jsonb_build_object('status', rec.status, 'assigned_to', rec.assigned_to, 'customer_id', rec.customer_id);

  elsif tg_table_name = 'marketing_campaigns' then
    if    tg_op = 'INSERT' then v_action := 'campaign.created';
    elsif new.status is distinct from old.status and new.status = 'sent' then v_action := 'campaign.sent';
    else  v_action := 'campaign.updated';
    end if;
    v_meta := jsonb_build_object('name', rec.name, 'segment', rec.segment, 'recipients', rec.recipient_count);

  else
    v_action := tg_table_name || '.' || lower(tg_op);
  end if;

  insert into public.audit_log (org_id, actor_user_id, action, entity, entity_id, meta)
  values (v_org, v_actor, v_action, tg_table_name, rec.id, v_meta);
  return null;
end $$;

drop trigger if exists trg_audit_marketing_campaigns on public.marketing_campaigns;
create trigger trg_audit_marketing_campaigns after insert or update on public.marketing_campaigns
  for each row execute function public.audit_event();

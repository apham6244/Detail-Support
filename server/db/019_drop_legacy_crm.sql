-- ============================================================================
-- Migration 019 — Remove the legacy outreach-CRM schema
--
-- ⚠️ DESTRUCTIVE. Read the guard below before running.
--
-- This database still carries the ORIGINAL outreach-CRM schema (schema.sql +
-- 002 + 003) underneath the Detail Support system (010–018). None of it is
-- used any more: the frontend never references it, migrations 010–018 never
-- reference it, and the dead backend CRM modules that did have been deleted.
-- Its leftover `campaigns` table is also what broke migration 018.
--
-- SAFETY: step 0 counts every legacy table (running as postgres, so RLS does
-- NOT hide rows) and ABORTS the whole migration if a single row exists.
-- Nothing is dropped unless they are genuinely empty.
--
-- DELIBERATELY KEPT (created by schema.sql but now core to 010–018):
--   • public.profiles                (+ its trg_touch_profiles trigger)
--   • public.handle_new_user()       — signup provisioning (redefined by 015)
--   • public.touch_updated_at()      — used by every current table
--   • trigger on_auth_user_created   — on auth.users
--   • enum user_role                 — profiles.role is still typed user_role.
--     The app doesn't use profiles.role (roles live in memberships), but the
--     column is on an ACTIVE table, so both are left alone. Removing them is a
--     separate, explicit decision.
--
-- Also untouched: everything from 010–018, including marketing_campaigns and
-- its marketing_campaign_status enum (distinct from the legacy campaign_status).
--
-- Idempotent: safe to re-run — every drop is `if exists`, and the guard skips
-- tables that are already gone.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) GUARD — abort if any legacy table still holds data.
-- ---------------------------------------------------------------------------
do $$
declare
  t         text;
  n         bigint;
  offenders text := '';
begin
  foreach t in array array[
    'businesses', 'contacts', 'leads', 'email_templates', 'campaigns',
    'campaign_recipients', 'sent_emails', 'email_events', 'follow_ups',
    'suppressions', 'lead_activities'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        offenders := offenders || format('%s(%s) ', t, n);
      end if;
    end if;
  end loop;

  if offenders <> '' then
    raise exception
      'ABORTED — legacy CRM tables still contain data: %. Nothing was dropped. Export or clear them first.',
      offenders;
  end if;

  raise notice 'Guard passed: all legacy CRM tables are empty.';
end $$;

-- ---------------------------------------------------------------------------
-- 1) View that reads the legacy tables.
-- ---------------------------------------------------------------------------
drop view if exists public.analytics_campaign_stats;

-- ---------------------------------------------------------------------------
-- 2) Legacy tables. One statement + CASCADE so inter-table foreign keys don't
--    dictate ordering; CASCADE here only reaches objects owned by these tables
--    (their indexes, owner_all policies, trg_touch_*/trg_lead_status/
--    trg_email_sent/trg_email_event triggers, FKs, and the 003 columns on
--    leads). No active 010–018 object depends on any of them — verified.
--
--    NOTE: this drops the LEGACY public.campaigns (owner_id/template_id).
--    public.marketing_campaigns (018) is NOT in this list and is unaffected.
-- ---------------------------------------------------------------------------
drop table if exists
  public.campaign_recipients,
  public.email_events,
  public.sent_emails,
  public.lead_activities,
  public.follow_ups,
  public.campaigns,
  public.email_templates,
  public.leads,
  public.contacts,
  public.businesses,
  public.suppressions
cascade;

-- ---------------------------------------------------------------------------
-- 3) Functions that existed only to log lead activity (migration 002).
--    touch_updated_at() and handle_new_user() are NOT dropped — still in use.
-- ---------------------------------------------------------------------------
drop function if exists public.log_lead_status_change();
drop function if exists public.log_email_sent();
drop function if exists public.log_email_event();

-- ---------------------------------------------------------------------------
-- 4) Legacy enums (now unreferenced once the tables above are gone).
--    user_role is intentionally NOT dropped — profiles.role still uses it.
--    campaign_status here is the legacy 5-value type, not our
--    marketing_campaign_status.
-- ---------------------------------------------------------------------------
drop type if exists public.activity_type;
drop type if exists public.business_category;
drop type if exists public.lead_status;
drop type if exists public.lead_source;
drop type if exists public.campaign_status;
drop type if exists public.send_status;
drop type if exists public.email_event_type;
drop type if exists public.followup_status;

-- ---------------------------------------------------------------------------
-- 5) Report what remains, so the result is visible in the SQL editor output.
-- ---------------------------------------------------------------------------
do $$
declare leftovers text;
begin
  select coalesce(string_agg(t, ', '), 'none') into leftovers
  from unnest(array[
    'businesses','contacts','leads','email_templates','campaigns',
    'campaign_recipients','sent_emails','email_events','follow_ups',
    'suppressions','lead_activities','analytics_campaign_stats'
  ]) as t
  where to_regclass('public.' || t) is not null;

  raise notice 'Legacy objects remaining: %', leftovers;
  raise notice 'Kept (active): profiles, handle_new_user(), touch_updated_at(), on_auth_user_created, user_role enum.';
  raise notice 'Kept (018): marketing_campaigns + marketing_campaign_status.';
end $$;

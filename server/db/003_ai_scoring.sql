-- ============================================================================
-- Migration 003 — AI lead scoring + reply analysis (phase 1)
-- Run AFTER 002_lead_activities.sql.
-- ============================================================================

-- New activity types for the communication-history timeline.
alter type activity_type add value if not exists 'ai_scored';
alter type activity_type add value if not exists 'ai_reply_analyzed';

-- AI score columns on leads (advisory — always shown with reasons).
alter table public.leads
  add column if not exists ai_score      int,
  add column if not exists ai_tier       text check (ai_tier in ('hot', 'warm', 'cold')),
  add column if not exists ai_reasons    jsonb,
  add column if not exists ai_scored_at  timestamptz;

-- Sort "top leads" fast; NULLS LAST so unscored leads fall to the bottom.
create index if not exists idx_leads_ai_score
  on public.leads (owner_id, ai_score desc nulls last);

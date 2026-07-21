-- ============================================================================
-- Migration 022 — Delivery queue: reminder scheduling + campaign send results
--
-- The reminder scheduler must be safe to run repeatedly and on more than one
-- instance, and must never send the same reminder twice. That's done with the
-- classic claim pattern: a single atomic UPDATE ... FOR UPDATE SKIP LOCKED
-- moves due rows pending -> sending and hands them to exactly one worker.
--
--   pending  -> sending -> sent            (happy path)
--                       -> pending/failed  (send threw; retried up to 3 times)
--
-- Only the service role may claim — the scheduler runs with no user session.
--
-- Run AFTER 021. Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) New reminder states. ALTER TYPE ... ADD VALUE cannot be used in the same
--    transaction that adds it, so these only ADD the labels; nothing below
--    references them as literals.
-- ---------------------------------------------------------------------------
alter type reminder_status add value if not exists 'sending';
alter type reminder_status add value if not exists 'failed';

-- ---------------------------------------------------------------------------
-- 2) Retry bookkeeping
-- ---------------------------------------------------------------------------
alter table public.appointment_reminders
  add column if not exists attempts    int not null default 0,
  add column if not exists last_error  text,
  add column if not exists claimed_at  timestamptz;

create index if not exists idx_reminders_claimable
  on public.appointment_reminders (remind_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 3) Campaign send results
-- ---------------------------------------------------------------------------
alter table public.marketing_campaigns
  add column if not exists failed_count int not null default 0,
  add column if not exists last_error   text;

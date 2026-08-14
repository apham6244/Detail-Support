-- 028_quote_internal_notes.sql
-- Adds a private, staff-only note to a quote. Unlike `notes` (the customer note
-- shown on the quote), `internal_notes` is never surfaced to the customer — it's
-- for the shop's own reference (pricing rationale, prep reminders, etc.).
--
-- Safe to run more than once. Inherits the quotes table's existing owner/admin
-- RLS, so no policy changes are needed.
--
-- Run AFTER 027_customer_referral.sql.

alter table public.quotes
  add column if not exists internal_notes text;

comment on column public.quotes.internal_notes is
  'Private staff-only note. Never shown on the customer-facing quote. Optional.';

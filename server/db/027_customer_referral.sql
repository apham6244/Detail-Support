-- 027_customer_referral.sql
-- Adds "how did they find us?" to the customer record so the customer profile's
-- referral-source insight persists for real accounts. Optional free-text /
-- short label (e.g. "Instagram", "Referral", "Google", "Walk-in").
--
-- Safe to run more than once. Inherits the customers table's existing
-- membership-based RLS, so no policy changes are needed.
--
-- Run AFTER 026_leads.sql.

alter table public.customers
  add column if not exists referral_source text;

comment on column public.customers.referral_source is
  'How the customer found the shop (Instagram, Referral, Google, Walk-in, …). Optional.';

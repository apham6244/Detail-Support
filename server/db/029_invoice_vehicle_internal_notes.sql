-- 029_invoice_vehicle_internal_notes.sql
-- Adds two optional fields to invoices, mirroring quotes:
--   * vehicle_id     — which vehicle the invoice is for (nullable FK).
--   * internal_notes — private staff-only note, never shown to the customer.
--
-- Safe to run more than once. Inherits the invoices table's existing
-- membership-based RLS, so no policy changes are needed.
--
-- Run AFTER 028_quote_internal_notes.sql.

alter table public.invoices
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;

alter table public.invoices
  add column if not exists internal_notes text;

comment on column public.invoices.vehicle_id is
  'The vehicle this invoice is for. Optional.';
comment on column public.invoices.internal_notes is
  'Private staff-only note. Never shown on the customer-facing invoice. Optional.';

-- ============================================================================
-- Migration 020 — Job photos for the customer CRM
--
-- The customer + vehicle data model already exists (011): customers carry
-- name/email/phone/address/notes, vehicles carry make/model/year/colour/plate/
-- VIN/notes. Service history is derivable from appointments + invoices, so it
-- needs no schema. The one genuinely missing piece is PHOTOS.
--
-- Photos live in a PRIVATE Supabase Storage bucket, with one row per photo
-- here for metadata (caption, which customer/vehicle/job it belongs to).
--
-- Storage path convention — this is what the storage policies key off:
--     job-photos/{org_id}/{customer_id}/{uuid}.{ext}
--
-- Access mirrors customers (017): owners/admins see everything in their org;
-- a detailer only sees photos for customers they have an assigned job for.
--
-- Run AFTER 010–018. Additive + idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Photo metadata
-- ---------------------------------------------------------------------------
create table if not exists public.job_photos (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  customer_id    uuid not null references public.customers(id) on delete cascade,
  vehicle_id     uuid references public.vehicles(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  storage_path   text not null unique,
  caption        text,
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_job_photos_customer on public.job_photos(customer_id, created_at desc);
create index if not exists idx_job_photos_org      on public.job_photos(org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2) RLS — same shape as customers (017)
-- ---------------------------------------------------------------------------
alter table public.job_photos enable row level security;
drop policy if exists photos_read   on public.job_photos;
drop policy if exists photos_insert on public.job_photos;
drop policy if exists photos_delete on public.job_photos;
create policy photos_read on public.job_photos for select
  using (public.is_org_admin(org_id) or public.customer_has_my_job(customer_id));
create policy photos_insert on public.job_photos for insert
  with check (public.is_org_admin(org_id) or public.customer_has_my_job(customer_id));
create policy photos_delete on public.job_photos for delete
  using (public.is_org_admin(org_id) or public.customer_has_my_job(customer_id));

-- ---------------------------------------------------------------------------
-- 3) Storage bucket — private, images only, 10 MB per file.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 4) Storage RLS — read the org/customer ids out of the object path.
--    Returns null on a malformed path so the policy simply denies instead of
--    erroring on a bad cast.
-- ---------------------------------------------------------------------------
create or replace function public.storage_path_uuid(p_name text, p_idx int)
returns uuid language plpgsql immutable as $$
begin
  return ((storage.foldername(p_name))[p_idx])::uuid;
exception when others then
  return null;
end $$;

drop policy if exists job_photos_select on storage.objects;
drop policy if exists job_photos_insert on storage.objects;
drop policy if exists job_photos_delete on storage.objects;

create policy job_photos_select on storage.objects for select using (
  bucket_id = 'job-photos' and (
    public.is_org_admin(public.storage_path_uuid(name, 1))
    or public.customer_has_my_job(public.storage_path_uuid(name, 2))
  )
);

create policy job_photos_insert on storage.objects for insert with check (
  bucket_id = 'job-photos' and (
    public.is_org_admin(public.storage_path_uuid(name, 1))
    or public.customer_has_my_job(public.storage_path_uuid(name, 2))
  )
);

create policy job_photos_delete on storage.objects for delete using (
  bucket_id = 'job-photos' and (
    public.is_org_admin(public.storage_path_uuid(name, 1))
    or public.customer_has_my_job(public.storage_path_uuid(name, 2))
  )
);

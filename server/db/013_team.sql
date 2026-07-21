-- ============================================================================
-- Migration 013 — Detail Support Phase 3: team roles, invitations & RBAC
--
-- Roles: owner | admin | employee (Detailer)
--   owner    — full control; manage roles, remove members, transfer ownership,
--              edit org, everything an admin can do.
--   admin    — manage customers/vehicles/services/appointments/invoices;
--              invite employees; cannot delete the org, transfer ownership,
--              or manage owner/admin members.
--   employee — Detailer. Read customers/appointments/vehicles/services;
--              create/edit customers, vehicles, appointments. No deletes,
--              no services catalog edits, no invoices/billing.
--
-- Run AFTER 010/011/012. Additive + idempotent (safe to re-run).
-- NOTE: written with explicit statements + non-nested dollar quotes so it runs
-- cleanly in the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Reshape the member_role enum: owner/manager/technician -> owner/admin/employee
--    (small data, early stage — recreate the type and remap existing rows).
--    Guarded so it only runs once.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_type where typname = 'member_role')
     and not exists (
       select 1 from pg_enum e
       join pg_type t on t.oid = e.enumtypid
       where t.typname = 'member_role' and e.enumlabel = 'employee'
     )
  then
    alter type member_role rename to member_role_old;
    create type member_role as enum ('owner', 'admin', 'employee');

    alter table public.memberships alter column role drop default;
    alter table public.memberships
      alter column role type member_role using (
        case role::text
          when 'manager' then 'admin'
          when 'technician' then 'employee'
          else role::text
        end::member_role
      );
    alter table public.memberships alter column role set default 'employee';

    alter table public.invitations alter column role drop default;
    alter table public.invitations
      alter column role type member_role using (
        case role::text
          when 'manager' then 'admin'
          when 'technician' then 'employee'
          else role::text
        end::member_role
      );
    alter table public.invitations alter column role set default 'employee';

    drop type member_role_old;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Invitations: add revoked_at + guard against duplicate pending invites.
-- ---------------------------------------------------------------------------
alter table public.invitations add column if not exists revoked_at timestamptz;

create unique index if not exists uniq_pending_invite
  on public.invitations (org_id, email)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- 3) profiles: store email + let teammates read each other's profile.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email citext;

-- Fill emails for any existing users.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- shares_org(): true if the given user is in one of my orgs. SECURITY DEFINER
-- so it doesn't trip profiles/memberships RLS (and can't recurse).
create or replace function public.shares_org(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user and b.status = 'active'
  );
$$;

drop policy if exists profile_self on public.profiles;
drop policy if exists profile_team_read on public.profiles;
-- Read: your own row OR a teammate's. Write: only your own.
create policy profile_team_read on public.profiles for select
  using (id = auth.uid() or public.shares_org(id));
create policy profile_self_write on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) Role helpers (SECURITY DEFINER; build on current_org_role from 010).
-- ---------------------------------------------------------------------------
create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_org_role(p_org) in ('owner', 'admin');
$$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_org_role(p_org) = 'owner';
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS — re-map every policy to the owner/admin/employee model.
-- ---------------------------------------------------------------------------

-- organizations: read = member, update = owner/admin (no delete exposed).
drop policy if exists org_write on public.organizations;
create policy org_write on public.organizations for update
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- memberships: read = member; direct writes = owner only (role changes go
-- through SECURITY DEFINER RPCs below, which bypass RLS).
drop policy if exists mem_write on public.memberships;
create policy mem_write on public.memberships for all
  using (public.is_org_owner(org_id)) with check (public.is_org_owner(org_id));

-- invitations: read/manage = owner/admin. Insert respects who-can-invite-whom.
drop policy if exists inv_all on public.invitations;
drop policy if exists inv_read on public.invitations;
drop policy if exists inv_insert on public.invitations;
drop policy if exists inv_update on public.invitations;
drop policy if exists inv_delete on public.invitations;
create policy inv_read on public.invitations for select
  using (public.is_org_admin(org_id));
create policy inv_insert on public.invitations for insert with check (
  (public.current_org_role(org_id) = 'owner'  and role in ('admin', 'employee'))
  or
  (public.current_org_role(org_id) = 'admin'  and role = 'employee')
);
create policy inv_update on public.invitations for update
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy inv_delete on public.invitations for delete
  using (public.is_org_admin(org_id));

-- Business tables. Helper pattern per table below.
-- customers / vehicles / appointments: read+create+edit = any member,
--   delete = owner/admin.
-- services: read = member, all writes = owner/admin.
-- invoices / invoice_line_items: owner/admin only (billing is not for detailers).

-- customers
drop policy if exists member_read   on public.customers;
drop policy if exists member_insert on public.customers;
drop policy if exists member_update on public.customers;
drop policy if exists manager_delete on public.customers;
drop policy if exists admin_delete  on public.customers;
create policy member_read   on public.customers for select using (public.is_org_member(org_id));
create policy member_insert on public.customers for insert with check (public.is_org_member(org_id));
create policy member_update on public.customers for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy admin_delete  on public.customers for delete using (public.is_org_admin(org_id));

-- vehicles
drop policy if exists member_read   on public.vehicles;
drop policy if exists member_insert on public.vehicles;
drop policy if exists member_update on public.vehicles;
drop policy if exists manager_delete on public.vehicles;
drop policy if exists admin_delete  on public.vehicles;
create policy member_read   on public.vehicles for select using (public.is_org_member(org_id));
create policy member_insert on public.vehicles for insert with check (public.is_org_member(org_id));
create policy member_update on public.vehicles for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy admin_delete  on public.vehicles for delete using (public.is_org_admin(org_id));

-- appointments
drop policy if exists member_read   on public.appointments;
drop policy if exists member_insert on public.appointments;
drop policy if exists member_update on public.appointments;
drop policy if exists manager_delete on public.appointments;
drop policy if exists admin_delete  on public.appointments;
create policy member_read   on public.appointments for select using (public.is_org_member(org_id));
create policy member_insert on public.appointments for insert with check (public.is_org_member(org_id));
create policy member_update on public.appointments for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy admin_delete  on public.appointments for delete using (public.is_org_admin(org_id));

-- services (catalog is owner/admin managed; everyone can read)
drop policy if exists member_read   on public.services;
drop policy if exists member_insert on public.services;
drop policy if exists member_update on public.services;
drop policy if exists manager_delete on public.services;
drop policy if exists admin_write   on public.services;
create policy member_read on public.services for select using (public.is_org_member(org_id));
create policy admin_write on public.services for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- invoices (billing — owner/admin only, including read)
drop policy if exists member_read   on public.invoices;
drop policy if exists member_insert on public.invoices;
drop policy if exists member_update on public.invoices;
drop policy if exists manager_delete on public.invoices;
drop policy if exists admin_all     on public.invoices;
create policy admin_all on public.invoices for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- invoice_line_items (billing — owner/admin only)
drop policy if exists member_read   on public.invoice_line_items;
drop policy if exists member_insert on public.invoice_line_items;
drop policy if exists member_update on public.invoice_line_items;
drop policy if exists manager_delete on public.invoice_line_items;
drop policy if exists admin_all     on public.invoice_line_items;
create policy admin_all on public.invoice_line_items for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- 6) Invitation RPCs (SECURITY DEFINER — role checks enforced in-function).
-- ---------------------------------------------------------------------------

-- Read invite details by token (invitee is not yet a member, so RLS would
-- hide it — this definer function exposes just enough to render the page).
create or replace function public.get_invitation(p_token text)
returns table (
  org_id uuid, org_name text, role text, email text,
  status text, invited_by_name text
)
language sql stable security definer set search_path = public as $$
  select
    i.org_id,
    o.name,
    i.role::text,
    i.email::text,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at  is not null then 'revoked'
      when i.expires_at  <  now()    then 'expired'
      else 'pending'
    end,
    p.full_name
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

-- Accept an invitation: joins the caller to the org with the invited role.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv     public.invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invitation.';
  end if;

  select * into inv from public.invitations where token = p_token;
  if not found then raise exception 'Invitation not found.'; end if;
  if inv.accepted_at is not null then raise exception 'This invitation was already accepted.'; end if;
  if inv.revoked_at  is not null then raise exception 'This invitation was revoked.'; end if;
  if inv.expires_at  <  now()    then raise exception 'This invitation has expired.'; end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email <> lower(inv.email::text) then
    raise exception 'This invitation was sent to %. Sign in with that email to accept.', inv.email;
  end if;

  insert into public.memberships (org_id, user_id, role, status)
  values (inv.org_id, auth.uid(), inv.role, 'active')
  on conflict (org_id, user_id) do update
    set role = excluded.role, status = 'active';

  update public.invitations set accepted_at = now() where id = inv.id;
  return inv.org_id;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Member-management RPCs (owner-gated).
-- ---------------------------------------------------------------------------

create or replace function public.set_member_role(p_membership uuid, p_role text)
returns void
language plpgsql security definer set search_path = public as $$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership;
  if not found then raise exception 'Member not found.'; end if;
  if public.current_org_role(m.org_id) <> 'owner' then
    raise exception 'Only the owner can change roles.';
  end if;
  if p_role not in ('admin', 'employee') then
    raise exception 'Role must be admin or employee.';
  end if;
  if m.role = 'owner' then
    raise exception 'The owner role can only change through Transfer ownership.';
  end if;
  update public.memberships set role = p_role::member_role where id = m.id;
end $$;

create or replace function public.remove_member(p_membership uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership;
  if not found then raise exception 'Member not found.'; end if;
  if public.current_org_role(m.org_id) <> 'owner' then
    raise exception 'Only the owner can remove members.';
  end if;
  if m.role = 'owner' then
    raise exception 'The owner cannot be removed. Transfer ownership first.';
  end if;
  delete from public.memberships where id = m.id;
end $$;

-- Transfer ownership: promote target to owner, demote current owner to admin,
-- and update organizations.owner_user_id — all in one transaction.
create or replace function public.transfer_ownership(p_membership uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m        public.memberships;
  v_caller uuid := auth.uid();
begin
  select * into m from public.memberships where id = p_membership;
  if not found then raise exception 'Member not found.'; end if;
  if public.current_org_role(m.org_id) <> 'owner' then
    raise exception 'Only the current owner can transfer ownership.';
  end if;
  if m.user_id = v_caller then
    raise exception 'You already own this workspace.';
  end if;

  update public.memberships set role = 'owner' where id = m.id;
  update public.memberships set role = 'admin'
    where org_id = m.org_id and user_id = v_caller;
  update public.organizations set owner_user_id = m.user_id where id = m.org_id;
end $$;

grant execute on function public.get_invitation(text)         to anon, authenticated;
grant execute on function public.accept_invitation(text)      to authenticated;
grant execute on function public.set_member_role(uuid, text)  to authenticated;
grant execute on function public.remove_member(uuid)          to authenticated;
grant execute on function public.transfer_ownership(uuid)     to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Signup provisioning — invited teammates must NOT get their own shop.
--    Rewritten from 010 to skip org creation when metadata invited = 'true'
--    and to record the profile email.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid;
  v_name text;
begin
  insert into public.profiles (id, full_name, business_name, email)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'business_name',
          new.email)
  on conflict (id) do update set email = excluded.email;

  -- Invited teammates join an existing org via accept_invitation — no new shop.
  if coalesce(new.raw_user_meta_data->>'invited', '') = 'true' then
    return new;
  end if;

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'business_name'), ''),
    nullif(trim(split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1)), '') || '''s Shop',
    'My Shop'
  );

  insert into public.organizations (name, owner_user_id, plan, trial_ends_at)
  values (v_name, new.id, 'trial', now() + interval '14 days')
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role, status)
  values (v_org, new.id, 'owner', 'active');

  return new;
end $$;

-- ============================================================================
-- Migration 025 — SECURITY FIX: owner guards failed open for non-members.
--
-- WHAT WAS WRONG
--   public.current_org_role(p_org) returns NULL when the caller is not a member
--   of that org (it is a plain SELECT that matches no row). The guards in 013
--   were written as:
--
--       if public.current_org_role(m.org_id) <> 'owner' then raise ...
--
--   In SQL, `NULL <> 'owner'` is not TRUE — it is NULL, and plpgsql's IF treats
--   NULL as false. So the guard did not fire for non-members: the exact people
--   it exists to stop walked straight through, while legitimate members
--   ('employee' <> 'owner' = TRUE) were correctly blocked. The check looked
--   right and tested fine against members, which is why it survived review.
--
-- IMPACT (verified by reproduction, not inspection)
--   set_member_role / remove_member / transfer_ownership are SECURITY DEFINER,
--   granted to `authenticated`, and resolve the membership row by id WITHOUT
--   scoping it to the caller's org — SECURITY DEFINER bypasses RLS, so they
--   read any tenant's row. Combined with the fail-open guard, any signed-in
--   user holding a membership UUID from another organization could change roles
--   in it, or delete its members.
--
--   Membership UUIDs are random, so this is not blind-guessable. The realistic
--   attacker is someone who already saw them and then lost access: a removed
--   employee or ex-admin. Removal is what turns their role from 'employee'
--   (blocked) into NULL (fails open) — the guard was weakest against precisely
--   the person most motivated to abuse it.
--
-- THE FIX
--   `is distinct from` is NULL-safe: NULL is distinct from 'owner' = TRUE, so
--   non-members raise. Plus defence in depth — each function now re-checks the
--   caller shares the target org before touching anything.
--
-- Idempotent (create or replace only). Safe to run on a live database: no data
-- is modified and the legitimate owner paths behave exactly as before.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- set_member_role
-- ---------------------------------------------------------------------------
create or replace function public.set_member_role(p_membership uuid, p_role text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership;
  -- Don't confirm the row exists to someone with no business in this org:
  -- same message either way, so this is not a membership-id oracle.
  if not found or not public.is_org_member(m.org_id) then
    raise exception 'Member not found.';
  end if;
  if public.current_org_role(m.org_id) is distinct from 'owner' then
    raise exception 'Only the owner can change roles.';
  end if;
  if p_role not in ('admin', 'employee') then
    raise exception 'Role must be admin or employee.';
  end if;
  if m.role = 'owner' then
    raise exception 'The owner role can only change through Transfer ownership.';
  end if;
  update public.memberships set role = p_role::member_role where id = m.id;
end $fn$;

-- ---------------------------------------------------------------------------
-- remove_member
-- ---------------------------------------------------------------------------
create or replace function public.remove_member(p_membership uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership;
  if not found or not public.is_org_member(m.org_id) then
    raise exception 'Member not found.';
  end if;
  if public.current_org_role(m.org_id) is distinct from 'owner' then
    raise exception 'Only the owner can remove members.';
  end if;
  if m.role = 'owner' then
    raise exception 'The owner cannot be removed. Transfer ownership first.';
  end if;
  delete from public.memberships where id = m.id;
end $fn$;

-- ---------------------------------------------------------------------------
-- transfer_ownership
-- ---------------------------------------------------------------------------
create or replace function public.transfer_ownership(p_membership uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  m        public.memberships;
  v_caller uuid := auth.uid();
begin
  select * into m from public.memberships where id = p_membership;
  if not found or not public.is_org_member(m.org_id) then
    raise exception 'Member not found.';
  end if;
  if public.current_org_role(m.org_id) is distinct from 'owner' then
    raise exception 'Only the current owner can transfer ownership.';
  end if;
  if m.user_id = v_caller then
    raise exception 'You already own this workspace.';
  end if;

  update public.memberships set role = 'owner' where id = m.id;
  update public.memberships set role = 'admin'
    where org_id = m.org_id and user_id = v_caller;
  update public.organizations set owner_user_id = m.user_id where id = m.org_id;
end $fn$;

grant execute on function public.set_member_role(uuid, text)  to authenticated;
grant execute on function public.remove_member(uuid)          to authenticated;
grant execute on function public.transfer_ownership(uuid)     to authenticated;

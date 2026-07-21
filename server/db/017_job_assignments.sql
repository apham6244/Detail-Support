-- ============================================================================
-- Migration 017 — Detail Support: Job Assignments & Team Scheduling (Team plan)
--
-- appointments.assigned_to (→ auth.users) already exists. This migration:
--   • adds assign_appointment() — owner/admin assigns a job to an org member.
--   • tightens RLS so an EMPLOYEE (detailer) only sees/updates the jobs
--     assigned to them, and only the customers/vehicles tied to those jobs.
--     Owners and admins are unaffected (full access).
--   • audits appointment create / assign / status changes.
--
-- Feature keys job_assignments + team_scheduling already exist (015, Team only).
-- Additive + idempotent. Run AFTER 010–016.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: does the caller have a job assigned for this customer?
-- SECURITY DEFINER so it can read appointments without tripping their RLS.
-- ---------------------------------------------------------------------------
create or replace function public.customer_has_my_job(p_customer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.appointments
    where customer_id = p_customer and assigned_to = auth.uid()
  );
$$;
grant execute on function public.customer_has_my_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Assign / reassign a job (owner/admin only; assignee must be an org member).
-- p_user = null unassigns.
-- ---------------------------------------------------------------------------
create or replace function public.assign_appointment(p_appt uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_appt;
  if not found then raise exception 'Appointment not found.'; end if;
  if not public.is_org_admin(a.org_id) then
    raise exception 'Only owners and admins can assign jobs.';
  end if;
  if p_user is not null and not exists (
      select 1 from public.memberships
      where org_id = a.org_id and user_id = p_user and status = 'active') then
    raise exception 'That person is not a member of this shop.';
  end if;
  update public.appointments set assigned_to = p_user where id = p_appt;
end $$;
grant execute on function public.assign_appointment(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — appointments: employees see/update only their assigned jobs;
-- create/reassign/delete are owner/admin.
-- ---------------------------------------------------------------------------
drop policy if exists member_read   on public.appointments;
drop policy if exists member_insert on public.appointments;
drop policy if exists member_update on public.appointments;
drop policy if exists admin_delete  on public.appointments;
drop policy if exists appt_read   on public.appointments;
drop policy if exists appt_insert on public.appointments;
drop policy if exists appt_update on public.appointments;
drop policy if exists appt_delete on public.appointments;
create policy appt_read   on public.appointments for select
  using (public.is_org_admin(org_id) or assigned_to = auth.uid());
create policy appt_insert on public.appointments for insert
  with check (public.is_org_admin(org_id));
create policy appt_update on public.appointments for update
  using (public.is_org_admin(org_id) or assigned_to = auth.uid())
  with check (public.is_org_admin(org_id) or assigned_to = auth.uid());
create policy appt_delete on public.appointments for delete
  using (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- RLS — customers: employees read/update only customers tied to their jobs;
-- create/delete are owner/admin.
-- ---------------------------------------------------------------------------
drop policy if exists member_read   on public.customers;
drop policy if exists member_insert on public.customers;
drop policy if exists member_update on public.customers;
drop policy if exists admin_delete  on public.customers;
drop policy if exists cust_read   on public.customers;
drop policy if exists cust_insert on public.customers;
drop policy if exists cust_update on public.customers;
drop policy if exists cust_delete on public.customers;
create policy cust_read   on public.customers for select
  using (public.is_org_admin(org_id) or public.customer_has_my_job(id));
create policy cust_insert on public.customers for insert
  with check (public.is_org_admin(org_id));
create policy cust_update on public.customers for update
  using (public.is_org_admin(org_id) or public.customer_has_my_job(id))
  with check (public.is_org_admin(org_id) or public.customer_has_my_job(id));
create policy cust_delete on public.customers for delete
  using (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- RLS — vehicles: same, keyed off the vehicle's customer.
-- ---------------------------------------------------------------------------
drop policy if exists member_read   on public.vehicles;
drop policy if exists member_insert on public.vehicles;
drop policy if exists member_update on public.vehicles;
drop policy if exists admin_delete  on public.vehicles;
drop policy if exists veh_read   on public.vehicles;
drop policy if exists veh_insert on public.vehicles;
drop policy if exists veh_update on public.vehicles;
drop policy if exists veh_delete on public.vehicles;
create policy veh_read   on public.vehicles for select
  using (public.is_org_admin(org_id) or public.customer_has_my_job(customer_id));
create policy veh_insert on public.vehicles for insert
  with check (public.is_org_admin(org_id));
create policy veh_update on public.vehicles for update
  using (public.is_org_admin(org_id) or public.customer_has_my_job(customer_id))
  with check (public.is_org_admin(org_id) or public.customer_has_my_job(customer_id));
create policy veh_delete on public.vehicles for delete
  using (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- Audit — extend audit_event() with an appointments branch (keeps all prior).
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

  else
    v_action := tg_table_name || '.' || lower(tg_op);
  end if;

  insert into public.audit_log (org_id, actor_user_id, action, entity, entity_id, meta)
  values (v_org, v_actor, v_action, tg_table_name, rec.id, v_meta);
  return null;
end $$;

drop trigger if exists trg_audit_appointments on public.appointments;
create trigger trg_audit_appointments after insert or update on public.appointments
  for each row execute function public.audit_event();

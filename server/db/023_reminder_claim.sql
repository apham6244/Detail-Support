-- ============================================================================
-- Migration 023 — Reminder claim + recovery (must run AFTER 022 commits)
--
-- Split from 022 deliberately: Postgres refuses to use an enum label in the
-- same transaction that added it ("unsafe use of new value of enum type"), and
-- these functions reference 'sending'. 022 adds the labels; 023 uses them.
--
-- claim_due_reminders() is the whole duplicate-send defence: one atomic
-- UPDATE ... FOR UPDATE SKIP LOCKED flips due rows pending -> sending and
-- returns them to exactly one caller. A second scheduler tick (or a second
-- instance) racing the first simply claims nothing. Safe to run repeatedly.
--
-- requeue_stale_reminders() recovers rows orphaned in 'sending' by a crash /
-- redeploy: back to pending, or failed once attempts run out.
--
-- Both are service-role only — the scheduler runs with no user session, and no
-- browser client should ever be able to drain the queue.
-- ============================================================================

create or replace function public.claim_due_reminders(p_limit int default 25)
returns setof public.appointment_reminders
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.appointment_reminders r
     set status     = 'sending',
         attempts   = r.attempts + 1,
         claimed_at = now()
   where r.id in (
     select id
       from public.appointment_reminders
      where status = 'pending'
        and remind_at <= now()
      order by remind_at
      for update skip locked
      limit greatest(coalesce(p_limit, 25), 1)
   )
  returning r.*;
end $$;

create or replace function public.requeue_stale_reminders(p_older_than interval default '10 minutes')
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with fixed as (
    update public.appointment_reminders
       set status     = case when attempts >= 3 then 'failed'::reminder_status
                             else 'pending'::reminder_status end,
           last_error = coalesce(last_error, 'Send was interrupted; requeued')
     where status = 'sending'
       and claimed_at is not null
       and claimed_at < now() - p_older_than
    returning 1
  )
  select count(*) into n from fixed;
  return n;
end $$;

-- Queue draining is never a client operation.
revoke all on function public.claim_due_reminders(int)          from public, anon, authenticated;
revoke all on function public.requeue_stale_reminders(interval)  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_due_reminders(int)         to service_role;
    grant execute on function public.requeue_stale_reminders(interval) to service_role;
  end if;
end $$;

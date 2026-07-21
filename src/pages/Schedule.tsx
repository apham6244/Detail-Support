import { useMemo, useState } from "react";
import { Clock, UserRound, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Loading, SignInPrompt, EmptyState } from "@/components/ui/data";
import { FeatureLocked } from "@/components/UpgradeGate";
import { useAppointments } from "@/hooks/useAppointments";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import {
  APPOINTMENT_STATUS_LABEL,
  vehicleLabel,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/models";
import { cn } from "@/lib/cn";

const STATUSES: AppointmentStatus[] = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"];

const statusStyle: Record<AppointmentStatus, string> = {
  scheduled: "text-brand-500 bg-brand-500/10",
  confirmed: "text-violet bg-violet/10",
  in_progress: "text-warning bg-warning/10",
  completed: "text-success bg-success/10",
  cancelled: "text-ink3 bg-line2",
  no_show: "text-danger bg-danger/10",
};

const dayKey = (iso: string) => iso.slice(0, 10);
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function dayHeading(key: string) {
  const d = new Date(key + "T00:00:00");
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - t0.getTime()) / 86_400_000);
  const rel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : null;
  const full = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return rel ? `${rel} · ${full}` : full;
}

export default function Schedule() {
  const { appointments, loading, ready, setStatus } = useAppointments();
  const { members, byId } = useMembers();
  const { role } = useAuth();
  const ent = useEntitlements();
  const [memberFilter, setMemberFilter] = useState<string>("all");

  const isManager = role === "owner" || role === "admin";

  const filtered = useMemo(() => {
    if (!isManager) return appointments; // RLS already scopes employees to their jobs
    return appointments.filter((a) => {
      if (memberFilter === "all") return true;
      if (memberFilter === "unassigned") return !a.assigned_to;
      return a.assigned_to === memberFilter;
    });
  }, [appointments, memberFilter, isManager]);

  const days = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const k = dayKey(a.scheduled_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, appts]) => ({ key, appts: appts.sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at)) }));
  }, [filtered]);

  if (!ready) return <SignInPrompt what="the schedule" />;
  if (ent.loading) return <Loading />;
  if (!ent.hasFeature("team_scheduling")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Schedule" subtitle="Your team's jobs, day by day" />
        <FeatureLocked
          feature="team_scheduling"
          title="Team scheduling"
          description="See every team member's jobs on a shared schedule, filter by detailer, and keep the whole crew in sync."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Schedule"
        subtitle={isManager ? "Your team's jobs, day by day" : "Your assigned jobs"}
        actions={
          isManager ? (
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="input h-[38px] w-auto text-[13px]"
            >
              <option value="all">All members</option>
              <option value="unassigned">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : days.length === 0 ? (
        <EmptyState
          art="garage"
          title={isManager ? "Nothing scheduled" : "No jobs assigned to you"}
          body={
            isManager
              ? "Book appointments and assign them to your team to fill the schedule."
              : "When an owner or admin assigns you a job, it'll appear here."
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <div key={day.key}>
              <div className="mb-2.5 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-500" />
                <h2 className="text-[14px] font-bold tracking-tight">{dayHeading(day.key)}</h2>
                <span className="text-xs text-ink3">
                  · {day.appts.length} job{day.appts.length === 1 ? "" : "s"}
                </span>
              </div>
              <Card className="divide-y divide-line2">
                {day.appts.map((a) => (
                  <JobRow key={a.id} appt={a} assigneeName={a.assigned_to ? byId.get(a.assigned_to)?.name : null} onStatus={setStatus} />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({
  appt,
  assigneeName,
  onStatus,
}: {
  appt: Appointment;
  assigneeName: string | null | undefined;
  onStatus: (id: string, s: AppointmentStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="flex w-[70px] flex-none items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Clock className="h-3.5 w-3.5 text-ink3" />
        {fmtTime(appt.scheduled_at)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{appt.customer?.name ?? "Customer"}</div>
        <div className="truncate text-xs text-ink3">
          {appt.service?.name ?? "Service"}
          {appt.vehicle ? ` · ${vehicleLabel(appt.vehicle)}` : ""}
        </div>
      </div>
      {assigneeName ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-brand-500">
          <UserRound className="h-3 w-3" />
          {assigneeName}
        </span>
      ) : (
        <span className="text-[11.5px] text-ink3">Unassigned</span>
      )}
      <select
        value={appt.status}
        onChange={(e) => onStatus(appt.id, e.target.value as AppointmentStatus)}
        className={cn(
          "cursor-pointer rounded-full border-0 px-2.5 py-1 text-[11.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/30",
          statusStyle[appt.status]
        )}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {APPOINTMENT_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

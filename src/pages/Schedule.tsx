import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, CheckCircle2, UserRound,
  CalendarDays, Users, Wrench, CircleDot, Lightbulb, ArrowRight, DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SignInPrompt, EmptyState, money } from "@/components/ui/data";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { FeatureLocked } from "@/components/UpgradeGate";
import { useAppointments } from "@/hooks/useAppointments";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import {
  APPOINTMENT_STATUS_LABEL, vehicleLabel,
  type Appointment, type AppointmentStatus,
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

/* Service-type accent — soft, modern, tied to the app palette. Each row's dot,
   avatar tint and service badge share one tone so a day scans by colour. */
type Tone = "purple" | "green" | "orange" | "blue" | "gray";
const SVC: Record<Tone, { badge: string; dot: string; avatar: string }> = {
  purple: { badge: "bg-violet/10 text-violet", dot: "bg-violet", avatar: "bg-violet/12 text-violet" },
  green:  { badge: "bg-success/10 text-success", dot: "bg-success", avatar: "bg-success/12 text-success" },
  orange: { badge: "bg-warning/10 text-warning", dot: "bg-warning", avatar: "bg-warning/12 text-warning" },
  blue:   { badge: "bg-brand-500/10 text-brand-500", dot: "bg-brand-500", avatar: "bg-brand-500/12 text-brand-500" },
  gray:   { badge: "bg-ink/[0.06] text-ink2", dot: "bg-ink3", avatar: "bg-ink/[0.06] text-ink2" },
};
const SVC_LEGEND: { tone: Tone; label: string }[] = [
  { tone: "purple", label: "Full Detail" },
  { tone: "green", label: "Interior Detail" },
  { tone: "gray", label: "Maintenance Wash" },
  { tone: "orange", label: "Paint Correction" },
  { tone: "blue", label: "Ceramic Coating" },
];

function serviceTone(name?: string | null): Tone {
  const n = (name ?? "").toLowerCase();
  if (n.includes("interior")) return "green";
  if (n.includes("paint") || n.includes("correction")) return "orange";
  if (n.includes("ceramic") || n.includes("coating")) return "blue";
  if (n.includes("maintenance") || n.includes("wash")) return "gray";
  if (n.includes("full") || n.includes("detail")) return "purple";
  return "gray";
}

const dayKey = (iso: string) => iso.slice(0, 10);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtTimeParts = (iso: string) => {
  const parts = new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).split(" ");
  return { hm: parts[0], ap: (parts[1] ?? "").toUpperCase() };
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayHeading(key: string) {
  const d = new Date(key + "T00:00:00");
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - t0.getTime()) / 86_400_000);
  const rel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : null;
  const full = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return { primary: rel ?? full, secondary: rel ? full : null };
}

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const isCompleted = (s: AppointmentStatus) => s === "completed";

export default function Schedule() {
  const { appointments, loading, ready, setStatus } = useAppointments();
  const { members, byId } = useMembers();
  const { role } = useAuth();
  const ent = useEntitlements();
  const navigate = useNavigate();

  const isManager = role === "owner" || role === "admin";
  const today = useMemo(() => new Date(), []);

  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string>(ymd(today));
  const [memberFilter, setMemberFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const dayRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const serviceNames = useMemo(() => {
    const s = new Set<string>();
    for (const a of appointments) if (a.service?.name) s.add(a.service.name);
    return [...s].sort();
  }, [appointments]);

  const filtered = useMemo(() => appointments.filter((a) => {
    if (isManager && memberFilter !== "all") {
      if (memberFilter === "unassigned" ? a.assigned_to : a.assigned_to !== memberFilter) return false;
    }
    if (serviceFilter !== "all" && a.service?.name !== serviceFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  }), [appointments, memberFilter, serviceFilter, statusFilter, isManager]);

  const monthStart = ymd(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  const days = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const k = dayKey(a.scheduled_at);
      if (k < monthStart || k > monthEnd) continue;
      (map.get(k) ?? map.set(k, []).get(k)!).push(a);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, appts]) => ({ key, appts: appts.sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at)) }));
  }, [filtered, monthStart, monthEnd]);

  const jobDots = useMemo(() => {
    const set = new Set<number>();
    for (const d of days) set.add(Number(d.key.slice(8, 10)));
    return set;
  }, [days]);

  const summary = useMemo(() => {
    const appts = filtered.filter((a) => dayKey(a.scheduled_at) === selectedDay);
    const active = appts.filter((a) => a.status !== "cancelled");
    return {
      jobs: appts.length,
      completed: appts.filter((a) => isCompleted(a.status)).length,
      inProgress: appts.filter((a) => a.status === "in_progress").length,
      upcoming: appts.filter((a) => a.status === "scheduled" || a.status === "confirmed").length,
      // Booked value for the day (every non-cancelled job's price), not just what's collected.
      scheduledRevenue: active.reduce((s, a) => s + (a.price ?? 0), 0),
      unassigned: active.filter((a) => !a.assigned_to).length,
      crew: new Set(active.filter((a) => a.assigned_to).map((a) => a.assigned_to)).size,
    };
  }, [filtered, selectedDay]);

  const insight = useMemo(() => {
    const tmrw = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
    const tmrwJobs = appointments.filter((a) => dayKey(a.scheduled_at) === tmrw).length;
    // Customers whose most recent visit is 90+ days ago.
    const last = new Map<string, number>();
    for (const a of appointments) {
      if (!a.customer_id) continue;
      const t = new Date(a.scheduled_at).getTime();
      last.set(a.customer_id, Math.max(last.get(a.customer_id) ?? 0, t));
    }
    const now = Date.now();
    const lapsed = [...last.values()].filter((t) => now - t > 90 * 86_400_000).length;
    if (tmrwJobs === 0) return { body: "You have openings tomorrow — a good day to reach out to lapsed clients.", cta: "Book a job", to: "/appointments" };
    if (lapsed > 0) return { body: `${lapsed} client${lapsed === 1 ? "" : "s"} haven't booked in over 90 days.`, cta: "View customers", to: "/customers" };
    return { body: "Your schedule is looking healthy. Nice work keeping the bays full.", cta: "Add a job", to: "/appointments" };
  }, [appointments, today]);

  const goToDay = (key: string) => {
    setSelectedDay(key);
    const el = dayRefs.current.get(key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!ready) return <SignInPrompt what="the schedule" />;
  if (ent.loading) return <PageSkeleton variant="list" kpis={0} toolbar={false} />;
  if (!ent.hasFeature("team_scheduling")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Schedule" subtitle="Your team's jobs, day by day" />
        <FeatureLocked feature="team_scheduling" title="Team scheduling"
          description="See every team member's jobs on a shared schedule, filter by detailer, and keep the whole crew in sync." />
      </div>
    );
  }

  const totalMonthJobs = days.reduce((s, d) => s + d.appts.length, 0);
  const shiftMonth = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToday = () => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(ymd(today)); };
  const todayKey = ymd(today);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Schedule"
        subtitle={isManager ? "Your team's jobs, day by day" : "Your assigned jobs"}
        actions={
          isManager ? (
            <Button variant="primary" onClick={() => navigate("/appointments")}>
              <Plus className="h-4 w-4" /> New Job
            </Button>
          ) : undefined
        }
      />

      {/* Month header — intentional, compact; the month leads, controls sit right */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-[18px] font-bold tracking-tight text-ink">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <span className="rounded-full bg-line2 px-2 py-0.5 text-[11.5px] font-semibold text-ink3">
            {totalMonthJobs} job{totalMonthJobs === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-panel p-1">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink2 transition-colors hover:bg-line2 hover:text-ink active:scale-90">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={goToday} className="rounded-lg px-3 text-[13px] font-semibold text-ink2 transition-colors hover:bg-line2 hover:text-ink">Today</button>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink2 transition-colors hover:bg-line2 hover:text-ink active:scale-90">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* -------- Main timeline -------- */}
        <main className="min-w-0">
          {loading ? (
            <PageSkeleton variant="list" kpis={0} toolbar={false} header={false} />
          ) : days.length === 0 ? (
            <EmptyState
              art="garage"
              title={isManager ? "Nothing scheduled this month" : "No jobs assigned to you"}
              body={isManager ? "Use the arrows to browse other months, or book a new job to fill the schedule." : "When an owner or admin assigns you a job, it'll appear here."}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {days.map((day) => {
                const allDone = day.appts.every((a) => isCompleted(a.status));
                const open = !collapsed.has(day.key);
                const h = dayHeading(day.key);
                const isSel = day.key === selectedDay;
                return (
                  <div key={day.key} ref={(el) => dayRefs.current.set(day.key, el)}
                    className={cn("surface overflow-hidden rounded-2xl transition-[box-shadow]", isSel && "ring-1 ring-inset ring-brand-500/25")}>
                    {/* Day header */}
                    <button
                      onClick={() => { setSelectedDay(day.key); setCollapsed((s) => { const n = new Set(s); n.has(day.key) ? n.delete(day.key) : n.add(day.key); return n; }); }}
                      aria-expanded={open}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-panel2/60 sm:px-5"
                    >
                      <ChevronDown className={cn("h-4 w-4 flex-none text-ink3 transition-transform duration-200", !open && "-rotate-90")} />
                      <h2 className="text-[14px] font-bold tracking-tight text-ink">{h.primary}</h2>
                      {h.secondary && <span className="hidden text-[12.5px] text-ink3 sm:inline">{h.secondary}</span>}
                      <span className="rounded-full bg-line2 px-2 py-0.5 text-[11px] font-semibold text-ink3">{day.appts.length} job{day.appts.length === 1 ? "" : "s"}</span>
                      <span className="ml-auto flex items-center">
                        {allDone ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-success">
                            <CheckCircle2 className="h-4 w-4" /> All jobs completed
                          </span>
                        ) : (
                          <span className="text-[12px] text-ink3">
                            {day.appts.filter((a) => isCompleted(a.status)).length}/{day.appts.length} done
                          </span>
                        )}
                      </span>
                    </button>

                    {open && (
                      <div className="border-t border-line">
                        {(() => {
                          const isTodayGroup = day.key === todayKey;
                          const nowMs = Date.now();
                          const out: React.ReactNode[] = [];
                          let placed = false;
                          for (const a of day.appts) {
                            if (isTodayGroup && !placed && new Date(a.scheduled_at).getTime() > nowMs) {
                              out.push(<NowLine key="now" />);
                              placed = true;
                            }
                            out.push(
                              <JobRow key={a.id} appt={a} allDone={allDone}
                                assigneeName={a.assigned_to ? byId.get(a.assigned_to)?.name : null}
                                onStatus={setStatus} />
                            );
                          }
                          return out;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Service legend */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11.5px] text-ink3">
            <span className="font-semibold uppercase tracking-[0.06em]">Service types</span>
            {SVC_LEGEND.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", SVC[s.tone].dot)} />{s.label}
              </span>
            ))}
          </div>
        </main>

        {/* -------- Utility sidebar -------- */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {/* Mini calendar */}
          <div className="surface rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-bold tracking-tight text-ink">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-line2 hover:text-ink"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-line2 hover:text-ink"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            <MiniCalendar month={month} today={today} selectedDay={selectedDay} jobDots={jobDots} onPick={goToDay} />
          </div>

          {/* Filters */}
          <div className="surface rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-bold tracking-tight text-ink">Filter</h3>
              {(memberFilter !== "all" || serviceFilter !== "all" || statusFilter !== "all") && (
                <button onClick={() => { setMemberFilter("all"); setServiceFilter("all"); setStatusFilter("all"); }} className="text-[12px] font-semibold text-brand-500 hover:text-brand-600">Clear</button>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              {isManager && (
                <FilterSelect icon={Users} value={memberFilter} onChange={setMemberFilter} label="Member">
                  <option value="all">All members</option>
                  <option value="unassigned">Unassigned</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                </FilterSelect>
              )}
              <FilterSelect icon={Wrench} value={serviceFilter} onChange={setServiceFilter} label="Service">
                <option value="all">All services</option>
                {serviceNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </FilterSelect>
              <FilterSelect icon={CircleDot} value={statusFilter} onChange={(v) => setStatusFilter(v as "all" | AppointmentStatus)} label="Status">
                <option value="all">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</option>)}
              </FilterSelect>
            </div>
          </div>

          {/* Day summary — the day at a glance, then the money + crew details */}
          <div className="surface rounded-2xl p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-[14px] font-bold tracking-tight text-ink">Day summary</h3>
              <span className="truncate text-[12px] text-ink3">{new Date(selectedDay + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatBlock label="Jobs" value={summary.jobs} />
              <StatBlock label="Completed" value={summary.completed} tone="text-success" />
              <StatBlock label="In progress" value={summary.inProgress} tone="text-warning" />
              <StatBlock label="Upcoming" value={summary.upcoming} tone="text-brand-500" />
            </div>
            <div className="mt-3 flex flex-col divide-y divide-line2 border-t border-line2 pt-1">
              <SummaryRow icon={DollarSign} tone="text-success" label="Scheduled revenue" value={money(summary.scheduledRevenue)} />
              {isManager && <SummaryRow icon={UserRound} tone={summary.unassigned ? "text-warning" : "text-ink3"} label="Unassigned" value={String(summary.unassigned)} />}
            </div>
          </div>

          {/* Insight */}
          <div className="surface rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Lightbulb className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-ink">Keep your schedule full</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink3">{insight.body}</p>
                <Link to={insight.to} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-500 hover:text-brand-600">
                  {insight.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function JobRow({ appt, allDone, assigneeName, onStatus }: {
  appt: Appointment; allDone: boolean; assigneeName: string | null | undefined;
  onStatus: (id: string, s: AppointmentStatus) => void;
}) {
  const tone = serviceTone(appt.service?.name);
  const { hm, ap } = fmtTimeParts(appt.scheduled_at);
  const custHref = appt.customer_id ? `/customers/${appt.customer_id}` : null;
  const svcName = appt.service?.name;
  const custName = appt.customer?.name ?? "Customer";
  const vehicle = appt.vehicle ? vehicleLabel(appt.vehicle) : null;
  // The service is the job — make it the scannable title. Customer + vehicle
  // support it. With no service on the record, the customer becomes the title.
  const title = svcName ?? custName;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="cv-row group flex items-stretch gap-3 px-4 transition-colors hover:bg-panel2/50 sm:gap-4 sm:px-5"
    >
      {/* Time */}
      <div className="flex w-[52px] flex-none flex-col items-end justify-center py-3.5 sm:w-[58px]">
        <span className="text-[16px] font-bold leading-none tracking-tight text-ink tnum">{hm}</span>
        <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">{ap}</span>
      </div>

      {/* Timeline rail + dot */}
      <div className="relative flex-none" style={{ width: 12 }}>
        <span aria-hidden className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-line2" />
        <span aria-hidden className={cn("absolute left-1/2 top-[22px] h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-4 ring-panel", SVC[tone].dot)} />
      </div>

      {/* Center — service is the scannable title; customer · vehicle supports it */}
      <div className="flex min-w-0 flex-1 items-center gap-3 py-3.5">
        <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold", SVC[tone].avatar)}>
          {initials(appt.customer?.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold tracking-tight text-ink">{title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] leading-tight">
            {svcName && (custHref
              ? <Link to={custHref} className="min-w-0 truncate font-semibold text-ink2 transition-colors hover:text-brand-500">{custName}</Link>
              : <span className="min-w-0 truncate font-semibold text-ink2">{custName}</span>)}
            {svcName && vehicle && <span aria-hidden className="flex-none text-line2">·</span>}
            {vehicle && <span className="min-w-0 truncate text-ink3">{vehicle}</span>}
          </div>
        </div>
      </div>

      {/* Right: technician + status */}
      <div className="flex flex-none items-center gap-2 py-3.5 sm:gap-3">
        {assigneeName ? (
          <span title={assigneeName} className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/10 text-[10.5px] font-bold text-brand-500">
            {initials(assigneeName)}
          </span>
        ) : (
          <span title="Unassigned" className="flex h-7 w-7 items-center justify-center rounded-full text-ink3/50"><UserRound className="h-4 w-4" /></span>
        )}
        <select
          value={appt.status}
          onChange={(e) => onStatus(appt.id, e.target.value as AppointmentStatus)}
          aria-label="Job status"
          className={cn(
            "cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-6 text-[11.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/30",
            allDone && isCompleted(appt.status) ? "bg-transparent text-success" : statusStyle[appt.status]
          )}
        >
          {STATUSES.map((s) => <option key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</option>)}
        </select>
      </div>
    </motion.div>
  );
}

/* Subtle "now" marker — sits on today's timeline, before the next job. */
function NowLine() {
  const { hm, ap } = fmtTimeParts(new Date().toISOString());
  return (
    <div className="flex items-stretch gap-3 px-4 sm:gap-4 sm:px-5">
      <div className="flex w-[52px] flex-none items-center justify-end sm:w-[58px]">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-brand-500">Now</span>
      </div>
      <div className="relative flex-none" style={{ width: 12 }}>
        <span aria-hidden className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-line2" />
        <span aria-hidden className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 ring-4 ring-panel" />
      </div>
      <div className="flex flex-1 items-center gap-2 py-1.5">
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-brand-500/50 to-transparent" />
        <span className="flex-none text-[10.5px] font-semibold tnum text-brand-500">{hm} {ap}</span>
      </div>
    </div>
  );
}

function MiniCalendar({ month, today, selectedDay, jobDots, onPick }: {
  month: Date; today: Date; selectedDay: string; jobDots: Set<number>; onPick: (key: string) => void;
}) {
  const year = month.getFullYear(), mo = month.getMonth();
  const firstDow = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const todayKey = ymd(today);
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-ink3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d.slice(0, 3)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((n, i) => {
          if (n === null) return <div key={i} />;
          const key = `${year}-${String(mo + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
          const isToday = key === todayKey;
          const isSel = key === selectedDay;
          const hasJobs = jobDots.has(n);
          return (
            <button key={i} onClick={() => onPick(key)} aria-label={`${MONTHS[mo]} ${n}${hasJobs ? ", has jobs" : ""}`}
              aria-current={isSel ? "date" : undefined}
              className="relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-lg text-[12.5px] transition-colors">
              <span className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full tnum transition-colors",
                isToday ? "bg-brand-500 font-bold text-white shadow-sm"
                  : isSel ? "bg-brand-500/10 font-bold text-brand-600 ring-1 ring-inset ring-brand-500/40"
                    : hasJobs ? "font-semibold text-ink hover:bg-line2"
                      : "font-medium text-ink3 hover:bg-line2"
              )}>{n}</span>
              {hasJobs && <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", isToday ? "bg-white" : "bg-brand-500")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSelect({ icon: Icon, value, onChange, label, children }: {
  icon: typeof Users; value: string; onChange: (v: string) => void; label: string; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink3" />
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink3" />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-line bg-panel2 pl-9 pr-9 text-[13px] font-medium text-ink transition-colors hover:border-ink3/50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
        {children}
      </select>
    </div>
  );
}

function SummaryRow({ icon: Icon, tone, label, value }: { icon: typeof CalendarDays; tone: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      <Icon className={cn("h-4 w-4 flex-none", tone)} />
      <span className="text-[13px] text-ink2">{label}</span>
      <span className="ml-auto text-[13px] font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/* Compact at-a-glance stat block for the day summary — small, not a KPI card. */
function StatBlock({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl bg-panel2/50 px-3 py-2.5 ring-1 ring-inset ring-line/50">
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink3">{label}</div>
      <div className={cn("mt-0.5 font-display text-[18px] font-bold leading-none tnum", tone ?? "text-ink")}>{value}</div>
    </div>
  );
}

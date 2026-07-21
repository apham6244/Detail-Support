import { useMemo, useState } from "react";
import { Gauge, CheckCircle2, DollarSign, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Th, Td, Loading, SignInPrompt, EmptyState, money } from "@/components/ui/data";
import { FeatureLocked } from "@/components/UpgradeGate";
import { useEntitlements } from "@/lib/entitlements";
import { useAppointments } from "@/hooks/useAppointments";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, type Role } from "@/lib/models";
import { cn } from "@/lib/cn";

type Range = "month" | "all";

export default function Performance() {
  const ent = useEntitlements();
  const { appointments, loading, ready } = useAppointments();
  const { members } = useMembers();
  const { role, user } = useAuth();
  const [range, setRange] = useState<Range>("month");

  const isManager = role === "owner" || role === "admin";

  const scoped = useMemo(() => {
    if (range === "all") return appointments;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return appointments.filter((a) => new Date(a.scheduled_at).getTime() >= monthStart);
  }, [appointments, range]);

  const rows = useMemo(() => {
    const base = isManager ? members : members.filter((m) => m.user_id === user?.id);
    return base
      .map((m) => {
        const jobs = scoped.filter((a) => a.assigned_to === m.user_id);
        const completed = jobs.filter((a) => a.status === "completed");
        const revenue = completed.reduce((s, a) => s + (a.price ?? 0), 0);
        return {
          user_id: m.user_id,
          name: m.name,
          role: m.role as Role,
          jobs: jobs.length,
          completed: completed.length,
          rate: jobs.length ? Math.round((completed.length / jobs.length) * 100) : 0,
          revenue,
          avg: completed.length ? revenue / completed.length : 0,
        };
      })
      .sort((a, b) => b.completed - a.completed || b.jobs - a.jobs);
  }, [members, scoped, isManager, user?.id]);

  const totals = useMemo(() => {
    const assigned = scoped.filter((a) => a.assigned_to);
    const completed = scoped.filter((a) => a.status === "completed");
    const revenue = completed.reduce((s, a) => s + (a.price ?? 0), 0);
    return {
      jobs: scoped.length,
      assigned: assigned.length,
      unassigned: scoped.length - assigned.length,
      completed: completed.length,
      rate: scoped.length ? Math.round((completed.length / scoped.length) * 100) : 0,
      revenue,
    };
  }, [scoped]);

  const maxJobs = rows.reduce((m, r) => Math.max(m, r.jobs), 0);

  if (!ready) return <SignInPrompt what="performance" />;
  if (ent.loading) return <Loading />;
  if (!ent.hasFeature("performance_tracking")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Performance" subtitle="How your team is doing" />
        <FeatureLocked
          feature="performance_tracking"
          title="Performance tracking"
          description="See jobs completed, completion rate, and revenue per team member — and spot who needs a hand."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Performance"
        subtitle={isManager ? "How your team is doing" : "How you're doing"}
        actions={
          <div className="flex rounded-lg bg-panel2 p-1 text-[12.5px] font-semibold">
            {(["month", "all"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  range === r ? "bg-panel text-ink shadow-sm" : "text-ink3"
                )}
              >
                {r === "month" ? "This month" : "All time"}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          {/* Totals — borderless band, dividers instead of cards */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 border-y border-line py-6 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-line">
            <Kpi icon={Briefcase} accent="brand" label="Jobs" value={String(totals.jobs)} sub={isManager ? `${totals.unassigned} unassigned` : "Assigned to you"} />
            <Kpi icon={CheckCircle2} accent="success" label="Completed" value={String(totals.completed)} sub={`${totals.rate}% completion`} />
            <Kpi icon={Gauge} accent="violet" label="Completion rate" value={`${totals.rate}%`} sub={range === "month" ? "This month" : "All time"} />
            <Kpi icon={DollarSign} accent="warning" label="Revenue" value={money(totals.revenue)} sub="From completed jobs" />
          </div>

          {/* Per-member — a heading on the page, then the table itself */}
          <section className="mt-9">
            <div className="mb-4">
              <h2 className="font-display text-[17px] font-bold tracking-tight text-ink">
                {isManager ? "By team member" : "Your numbers"}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink3">{range === "month" ? "This month" : "All time"}</p>
            </div>
            {rows.length === 0 ? (
              <EmptyState
                art="garage"
                title="No team members yet"
                body="Invite your crew from the Team page, then assign them jobs to track performance."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-panel2 text-left text-[11px] uppercase tracking-[0.07em] text-ink3">
                        <Th>Member</Th>
                        <Th>Jobs</Th>
                        <Th>Completed</Th>
                        <Th>Completion</Th>
                        <Th>Revenue</Th>
                        <Th>Avg / job</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.user_id} className="border-b border-line2 last:border-b-0">
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-bold uppercase text-brand-500">
                                {r.name.slice(0, 2)}
                              </span>
                              <div>
                                <div className="font-semibold text-ink">{r.name}</div>
                                <div className="text-[11.5px] text-ink3">{ROLE_LABEL[r.role] ?? r.role}</div>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <span className="w-5 tnum font-semibold">{r.jobs}</span>
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line2">
                                <div
                                  className="h-full rounded-full bg-brand-500"
                                  style={{ width: `${maxJobs ? (r.jobs / maxJobs) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          </Td>
                          <Td className="tnum">{r.completed}</Td>
                          <Td>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                                r.jobs === 0
                                  ? "bg-line2 text-ink3"
                                  : r.rate >= 80
                                    ? "bg-success/10 text-success"
                                    : r.rate >= 50
                                      ? "bg-warning/10 text-warning"
                                      : "bg-danger/10 text-danger"
                              )}
                            >
                              {r.jobs === 0 ? "—" : `${r.rate}%`}
                            </span>
                          </Td>
                          <Td className="tnum font-semibold">{money(r.revenue)}</Td>
                          <Td className="tnum text-ink2">{r.completed ? money(r.avg) : "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

type Accent = "brand" | "success" | "violet" | "warning";
const ACCENT_TEXT: Record<Accent, string> = {
  brand: "text-brand-500",
  success: "text-success",
  violet: "text-violet",
  warning: "text-warning",
};

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  sub: string;
  accent: Accent;
}) {
  return (
    <div className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-4 w-4", ACCENT_TEXT[accent])} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">{label}</span>
      </div>
      <div className="mt-2 font-display text-[27px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
      <div className="mt-2 truncate text-xs text-ink3">{sub}</div>
    </div>
  );
}

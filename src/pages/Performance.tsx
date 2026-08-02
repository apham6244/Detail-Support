import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  Gauge, CheckCircle2, DollarSign, ReceiptText, TrendingUp, TrendingDown,
  Lightbulb, Flame, UserPlus, Repeat, Clock, Trophy, Wrench, Users,
  CarFront, HeartHandshake, XCircle, CalendarX, Award, Lock, Activity, Rocket,
  CalendarPlus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SignInPrompt, InlineEmpty, money } from "@/components/ui/data";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";
import { Panel, Delta, ChartTip, KpiCard, MiniEmpty } from "@/components/ui/metric";
// EmptyArt is now reached via the shared MiniEmpty.
import { AXIS, TONE, lastMonths, monthKey, collected, pctDelta, type Tone, type Point } from "@/lib/metrics";
import { FeatureLocked } from "@/components/UpgradeGate";
import { useEntitlements } from "@/lib/entitlements";
import { useAppointments } from "@/hooks/useAppointments";
import { useInvoices } from "@/hooks/useInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useMembers } from "@/hooks/useMembers";
import { useGoogleReviews } from "@/hooks/useGoogleReviews";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, type Role } from "@/lib/models";
import { cn } from "@/lib/cn";

const DAY = 86_400_000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const SVC_COLORS = ["#2E7BFF", "#17A867", "#7A5BE0", "#E08A00", "#0EA5E9", "#E5484D"];

// series accessors (page-local; the canonical metric helpers live in @/lib/metrics)
const last = (s: Point[]) => s[s.length - 1]?.value ?? 0;
const prev = (s: Point[]) => s[s.length - 2]?.value ?? 0;
const growthScore = (deltaPct: number) => clamp(Math.round(55 + deltaPct * 2.25), 0, 100);

const LEVELS = [
  { min: 0, title: "Getting started" },
  { min: 10, title: "Weekend detailer" },
  { min: 25, title: "Rising pro" },
  { min: 50, title: "Established detailer" },
  { min: 100, title: "Professional detailer" },
  { min: 200, title: "Master detailer" },
  { min: 400, title: "Shop elite" },
  { min: 750, title: "Detailing legend" },
];

export default function Performance() {
  const ent = useEntitlements();
  const { appointments, loading: aL, ready } = useAppointments();
  const { invoices, loading: iL } = useInvoices();
  const { customers } = useCustomers();
  const { members } = useMembers();
  const { data: reviews, connected } = useGoogleReviews();
  const { role, user } = useAuth();

  const isManager = role === "owner" || role === "admin";
  const solo = members.length <= 1;
  const personal = !isManager;
  const months = useMemo(() => lastMonths(6), []);

  // ---- org-wide analytics -----------------------------------------------
  const d = useMemo(() => {
    const revByMonth: Record<string, number> = {};
    const paidByMonth: Record<string, number> = {};
    for (const inv of invoices) {
      const k = monthKey(inv.issued_at || inv.created_at);
      const c = collected(inv);
      revByMonth[k] = (revByMonth[k] ?? 0) + c;
      if (c > 0) paidByMonth[k] = (paidByMonth[k] ?? 0) + 1;
    }
    const apptByMonth: Record<string, { total: number; done: number }> = {};
    for (const a of appointments) {
      const b = (apptByMonth[monthKey(a.scheduled_at)] ??= { total: 0, done: 0 });
      b.total++; if (a.status === "completed") b.done++;
    }
    const custByMonth: Record<string, number> = {};
    for (const c of customers) custByMonth[monthKey(c.created_at)] = (custByMonth[monthKey(c.created_at)] ?? 0) + 1;

    const revenueSeries: Point[] = months.map((m) => ({ label: m.label, value: revByMonth[m.key] ?? 0 }));
    const completedSeries: Point[] = months.map((m) => ({ label: m.label, value: apptByMonth[m.key]?.done ?? 0 }));
    const bookedSeries: Point[] = months.map((m) => ({ label: m.label, value: apptByMonth[m.key]?.total ?? 0 }));
    const completionSeries: Point[] = months.map((m) => { const b = apptByMonth[m.key]; return { label: m.label, value: b?.total ? (b.done / b.total) * 100 : 0 }; });
    const ticketSeries: Point[] = months.map((m) => { const r = revByMonth[m.key] ?? 0, n = paidByMonth[m.key] ?? 0; return { label: m.label, value: n ? r / n : 0 }; });
    const newCustSeries: Point[] = months.map((m) => ({ label: m.label, value: custByMonth[m.key] ?? 0 }));

    // all-time
    const totalCollected = invoices.reduce((s, i) => s + collected(i), 0);
    const totalPaid = invoices.filter((i) => collected(i) > 0).length;
    const totalCompleted = appointments.filter((a) => a.status === "completed").length;
    const totalBooked = appointments.length;
    const avgTicketAll = totalPaid ? totalCollected / totalPaid : 0;

    // appointment status
    const st = { completed: 0, cancelled: 0, no_show: 0, active: 0 };
    for (const a of appointments) {
      if (a.status === "completed") st.completed++;
      else if (a.status === "cancelled") st.cancelled++;
      else if (a.status === "no_show") st.no_show++;
      else st.active++;
    }
    const completionRate = totalBooked ? (totalCompleted / totalBooked) * 100 : 0;

    // customers: repeat / new / inactive / follow-up
    const perCust: Record<string, number> = {};
    const lastDone: Record<string, number> = {};
    const upcoming = new Set<string>();
    const now = Date.now();
    for (const a of appointments) {
      perCust[a.customer_id] = (perCust[a.customer_id] ?? 0) + 1;
      const t = new Date(a.scheduled_at).getTime();
      if (a.status === "completed") lastDone[a.customer_id] = Math.max(lastDone[a.customer_id] ?? 0, t);
      if ((a.status === "scheduled" || a.status === "confirmed") && t >= now) upcoming.add(a.customer_id);
    }
    const repeatCount = Object.values(perCust).filter((n) => n >= 2).length;
    const repeatRate = customers.length ? (repeatCount / customers.length) * 100 : 0;
    const served = Object.entries(lastDone);
    const followUps = served.filter(([id, t]) => !upcoming.has(id) && now - t >= 45 * DAY && now - t < 90 * DAY).length;
    const inactive = served.filter(([id, t]) => !upcoming.has(id) && now - t >= 90 * DAY).length;
    const newThisMonth = last(newCustSeries);

    // services by revenue
    const svc: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const a of appointments) {
      const name = a.service?.name ?? "Other / walk-in";
      (svc[name] ??= { name, count: 0, revenue: 0 });
      svc[name].count += 1; svc[name].revenue += a.price ?? 0;
    }
    const services = Object.values(svc).filter((s) => s.revenue > 0).sort((a, b) => b.revenue - a.revenue);
    const svcRevTotal = services.reduce((s, x) => s + x.revenue, 0);
    const topEarner = services[0] ?? null;

    // pace
    const nowD = new Date();
    const dayOfMonth = nowD.getDate();
    const daysInMonth = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
    const pace = dayOfMonth > 0 ? (last(revenueSeries) / dayOfMonth) * daysInMonth : 0;

    // ---- health score ----
    const revScore = growthScore(pctDelta(revenueSeries));
    const custScore = growthScore(pctDelta(newCustSeries));
    const repeatScore = clamp(Math.round(repeatRate * 1.5), 0, 100);
    const bookingScore = Math.round(completionRate);
    const overall = Math.round(revScore * 0.3 + bookingScore * 0.25 + repeatScore * 0.25 + custScore * 0.2);
    const band =
      overall >= 80 ? { label: "Growing strong", tone: "green" as Tone } :
      overall >= 65 ? { label: "Healthy & steady", tone: "blue" as Tone } :
      overall >= 50 ? { label: "Building momentum", tone: "purple" as Tone } :
                      { label: "Needs attention", tone: "orange" as Tone };
    const categories = [
      { label: "Revenue growth", score: revScore, tone: "green" as Tone, icon: DollarSign },
      { label: "Customer growth", score: custScore, tone: "blue" as Tone, icon: CarFront },
      { label: "Repeat customers", score: repeatScore, tone: "purple" as Tone, icon: Repeat },
      { label: "Booking performance", score: bookingScore, tone: "orange" as Tone, icon: CalendarX },
    ];

    return {
      revenueSeries, completedSeries, bookedSeries, completionSeries, ticketSeries, newCustSeries,
      totalCollected, totalPaid, totalCompleted, totalBooked, avgTicketAll, completionRate,
      st, repeatCount, repeatRate, followUps, inactive, newThisMonth,
      services, svcRevTotal, topEarner, pace, dayOfMonth,
      health: { overall, band, categories },
    };
  }, [invoices, appointments, customers, months]);

  // ---- personal (employees) ---------------------------------------------
  const mine = useMemo(() => {
    const jobs = appointments.filter((a) => a.assigned_to === user?.id);
    const byMonth: Record<string, { total: number; done: number; rev: number }> = {};
    for (const a of jobs) {
      const b = (byMonth[monthKey(a.scheduled_at)] ??= { total: 0, done: 0, rev: 0 });
      b.total++; if (a.status === "completed") { b.done++; b.rev += a.price ?? 0; }
    }
    const completedSeries: Point[] = months.map((m) => ({ label: m.label, value: byMonth[m.key]?.done ?? 0 }));
    const revenueSeries: Point[] = months.map((m) => ({ label: m.label, value: byMonth[m.key]?.rev ?? 0 }));
    const bookedSeries: Point[] = months.map((m) => ({ label: m.label, value: byMonth[m.key]?.total ?? 0 }));
    const completionSeries: Point[] = months.map((m) => { const b = byMonth[m.key]; return { label: m.label, value: b?.total ? (b.done / b.total) * 100 : 0 }; });
    const done = jobs.filter((a) => a.status === "completed");
    return { completedSeries, revenueSeries, bookedSeries, completionSeries, totalCompleted: done.length, totalBooked: jobs.length, totalRevenue: done.reduce((s, a) => s + (a.price ?? 0), 0) };
  }, [appointments, user?.id, months]);

  // ---- team rows --------------------------------------------------------
  const teamRows = useMemo(() => members.map((m) => {
    const jobs = appointments.filter((a) => a.assigned_to === m.user_id);
    const done = jobs.filter((a) => a.status === "completed");
    const revenue = done.reduce((s, a) => s + (a.price ?? 0), 0);
    return { user_id: m.user_id, name: m.name, role: m.role as Role, jobs: jobs.length, completed: done.length, rate: jobs.length ? Math.round((done.length / jobs.length) * 100) : 0, revenue, avg: done.length ? revenue / done.length : 0 };
  }).sort((a, b) => b.revenue - a.revenue || b.completed - a.completed), [members, appointments]);
  const maxTeamRev = teamRows.reduce((m, r) => Math.max(m, r.revenue), 0);

  const rating = reviews?.rating ?? null;

  // ---- growth opportunities (rule-based, never AI) ----------------------
  const opps = useMemo(() => {
    const out: { icon: typeof Lightbulb; tone: Tone; text: React.ReactNode }[] = [];
    const tDelta = pctDelta(d.ticketSeries);
    if (prev(d.ticketSeries) > 0 && Math.abs(Math.round(tDelta)) >= 1) {
      const up = tDelta >= 0;
      out.push({ icon: up ? TrendingUp : TrendingDown, tone: up ? "green" : "orange",
        text: <>Your average ticket {up ? "increased" : "slipped"} <b className={up ? "text-success" : "text-warning"}>{Math.abs(Math.round(tDelta))}%</b> to {money(last(d.ticketSeries))}.</> });
    }
    if (d.inactive > 0) {
      out.push({ icon: Clock, tone: "orange",
        text: <>You have <b className="text-ink">{d.inactive} inactive {d.inactive === 1 ? "customer" : "customers"}</b> — a win-back offer could bring them in.</> });
    }
    if (d.topEarner) {
      out.push({ icon: Trophy, tone: "purple",
        text: <>Your <b className="text-ink">{d.topEarner.name}</b> is your highest-earning service at {money(d.topEarner.revenue)}.</> });
    }
    if (d.followUps > 0) {
      out.push({ icon: HeartHandshake, tone: "blue",
        text: <><b className="text-ink">{d.followUps}</b> {d.followUps === 1 ? "customer is" : "customers are"} due for a follow-up — reach out to rebook.</> });
    }
    if (d.completionRate > 0 && d.completionRate < 80 && d.totalBooked >= 5) {
      out.push({ icon: CalendarX, tone: "orange",
        text: <>Only <b className="text-ink">{Math.round(d.completionRate)}%</b> of bookings get completed — cutting cancellations lifts revenue.</> });
    }
    if (d.dayOfMonth >= 5 && prev(d.revenueSeries) > 0) {
      const ahead = d.pace >= prev(d.revenueSeries);
      out.push({ icon: ahead ? Flame : Activity, tone: ahead ? "green" : "blue",
        text: <>On pace for <b className="text-ink">{money(d.pace)}</b> this month — {ahead ? "ahead of" : "behind"} last month's {money(prev(d.revenueSeries))}.</> });
    }
    return out.slice(0, 5);
  }, [d]);

  // ---- gates ------------------------------------------------------------
  if (!ready) return <SignInPrompt what="performance" />;
  if (ent.loading) return <PageSkeleton variant="analytics" kpis={4} />;
  if (!ent.hasFeature("performance_tracking")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Performance" subtitle="How your shop is doing" />
        <FeatureLocked feature="performance_tracking" title="Performance tracking"
          description="Track your business health, revenue, retention and milestones — everything a growing detail shop needs to know." />
      </div>
    );
  }

  const loading = aL || iL;

  // ---- milestones -------------------------------------------------------
  const levelIdx = LEVELS.reduce((acc, l, i) => (d.totalCompleted >= l.min ? i : acc), 0);
  const levelNext = LEVELS[levelIdx + 1] ?? null;
  const levelProg = levelNext ? clamp((d.totalCompleted - LEVELS[levelIdx].min) / (levelNext.min - LEVELS[levelIdx].min), 0, 1) : 1;
  const achievements = [
    { label: "First 10 customers", icon: Users, current: customers.length, goal: 10 },
    { label: "25 completed details", icon: CheckCircle2, current: d.totalCompleted, goal: 25 },
    { label: "$5,000 revenue", icon: DollarSign, current: d.totalCollected, goal: 5000, money: true },
    { label: "100 completed details", icon: Trophy, current: d.totalCompleted, goal: 100 },
    { label: "$25,000 revenue", icon: Rocket, current: d.totalCollected, goal: 25000, money: true },
    { label: "50 repeat customers", icon: Repeat, current: d.repeatCount, goal: 50 },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Performance"
        subtitle={personal ? "Your jobs, completion and earnings" : "Your shop's health, growth and milestones"}
      />

      {loading ? (
        <PageSkeleton variant="analytics" kpis={4} header={false} />
      ) : personal ? (
        /* ---------- EMPLOYEE VIEW ---------- */
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard index={0} tone="green" icon={DollarSign} label="You earned" value={last(mine.revenueSeries)} format={money} delta={pctDelta(mine.revenueSeries)} sub={`${money(mine.totalCompleted ? mine.totalRevenue / mine.totalCompleted : 0)} avg / job`} series={mine.revenueSeries} />
            <KpiCard index={1} tone="blue" icon={CheckCircle2} label="Jobs completed" value={last(mine.completedSeries)} format={(n) => String(Math.round(n))} delta={pctDelta(mine.completedSeries)} sub={`of ${Math.round(last(mine.bookedSeries))} booked`} series={mine.completedSeries} />
            <KpiCard index={2} tone="purple" icon={Gauge} label="Completion rate" value={last(mine.completionSeries)} format={(n) => `${Math.round(n)}%`} delta={pctDelta(mine.completionSeries)} sub={`${Math.round(last(mine.completedSeries))} completed`} series={mine.completionSeries} />
            <KpiCard index={3} tone="orange" icon={ReceiptText} label="Lifetime jobs" value={mine.totalCompleted} format={(n) => String(Math.round(n))} delta={0} showDelta={false} sub={`${money(mine.totalRevenue)} earned`} series={mine.completedSeries} />
          </div>
          <Panel title="Your completed jobs" subtitle="Finished per month" icon={CheckCircle2} badge={<Delta value={pctDelta(mine.completedSeries)} />}>
            <JobsBars data={mine.completedSeries} />
          </Panel>
        </div>
      ) : (
        /* ---------- OWNER / ADMIN VIEW ---------- */
        <div className="flex flex-col gap-4">
          {/* 1 · Business Health Score */}
          <HealthScoreCard health={d.health} totalBooked={d.totalBooked} />

          {/* 2 · Core metrics (growth at a glance) */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard index={0} tone="green" icon={DollarSign} label="Revenue" value={last(d.revenueSeries)} format={money} delta={pctDelta(d.revenueSeries)} sub={`${money(last(d.ticketSeries))} avg / job`} series={d.revenueSeries} />
            <KpiCard index={1} tone="blue" icon={CheckCircle2} label="Jobs completed" value={last(d.completedSeries)} format={(n) => String(Math.round(n))} delta={pctDelta(d.completedSeries)} sub={`of ${Math.round(last(d.bookedSeries))} booked`} series={d.completedSeries} />
            <KpiCard index={2} tone="purple" icon={CarFront} label="New customers" value={d.newThisMonth} format={(n) => String(Math.round(n))} delta={pctDelta(d.newCustSeries)} sub={`${Math.round(d.repeatRate)}% come back`} series={d.newCustSeries} />
            <KpiCard index={3} tone="orange" icon={ReceiptText} label="Avg ticket" value={last(d.ticketSeries)} format={money} delta={pctDelta(d.ticketSeries)} sub={`${money(d.totalCollected)} all-time`} series={d.ticketSeries} />
          </div>

          {/* 3 · Revenue overview + Growth opportunities */}
          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Panel title="Revenue overview" subtitle="Collected revenue and completed jobs · 6 months"
              badge={<Legend items={[["Revenue", TONE.green.hex, false], ["Jobs", TONE.blue.hex, true]]} />}>
              {d.totalBooked === 0 ? <MiniEmpty text="Revenue appears once you've booked jobs and logged invoices." /> : <RevenueOverview revenue={d.revenueSeries} jobs={d.completedSeries} />}
            </Panel>
            <GrowthOpportunities opps={opps} />
          </div>

          {/* 4 · Revenue breakdown + Appointment performance */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* NB: this totals the price booked on each appointment, which is the
                only place service-level revenue exists. It will not equal the
                invoice-collected figure in the KPI band, so both are labelled
                distinctly ("booked" vs "collected") rather than implying parity. */}
            <Panel title="Revenue breakdown" subtitle="Booked value by service type" icon={Wrench}>
              {d.services.length === 0 ? <MiniEmpty text="Book jobs to see which services earn the most." /> : <RevenueBreakdown services={d.services} total={d.svcRevTotal} />}
            </Panel>
            <Panel title="Appointment performance" subtitle="Where your bookings land" icon={Activity}>
              {d.totalBooked === 0 ? <MiniEmpty text="No appointments booked yet." /> : <AppointmentPerformance d={d} />}
            </Panel>
          </div>

          {/* 5 · Retention + Growth comparison */}
          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <RetentionCard d={d} customers={customers.length} rating={rating} reviewsConnected={!!connected} />
            <ComparisonCard d={d} />
          </div>

          {/* 6 · Shop level + milestones */}
          <ShopLevelCard levelNum={levelIdx + 1} title={LEVELS[levelIdx].title} completed={d.totalCompleted}
            next={levelNext} prog={levelProg} achievements={achievements} />

          {/* 7 · Team performance (only when there's a crew) */}
          {!solo && <TeamPerformance rows={teamRows} maxRev={maxTeamRev} />}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Building blocks
// ===========================================================================

function Legend({ items }: { items: [string, string, boolean][] }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-medium text-ink3">
      {items.map(([name, color, round]) => (
        <span key={name} className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2", round ? "rounded-full" : "rounded-[3px]")} style={{ background: color }} />{name}
        </span>
      ))}
    </div>
  );
}

// ---- 1 · Business Health Score --------------------------------------------
function HealthScoreCard({ health, totalBooked }: { health: { overall: number; band: { label: string; tone: Tone }; categories: { label: string; score: number; tone: Tone; icon: typeof DollarSign }[] }; totalBooked: number }) {
  const hex = TONE[health.band.tone].hex;
  const r = 52, c = 2 * Math.PI * r;
  const off = c * (1 - (totalBooked ? health.overall : 0) / 100);
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="surface relative overflow-hidden rounded-[22px]">
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full opacity-50 blur-[90px]" style={{ background: hex, opacity: 0.14 }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-paint-gloss opacity-40" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-center">
        {/* gauge */}
        <div className="flex items-center gap-5">
          <div className="relative h-[128px] w-[128px] flex-none">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
              <circle cx="64" cy="64" r={r} fill="none" stroke="rgb(var(--line2))" strokeWidth="11" />
              <motion.circle cx="64" cy="64" r={r} fill="none" stroke={hex} strokeWidth="11" strokeLinecap="round"
                strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: off }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex items-baseline">
                <CountUp value={totalBooked ? health.overall : 0} format={(n) => String(Math.round(n))} className="font-display text-[34px] font-extrabold leading-none tracking-tight tnum text-ink" />
                <span className="ml-0.5 font-display text-[15px] font-bold text-ink3">/100</span>
              </div>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink3">Health</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink3">Business health score</div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: `${hex}1f`, color: hex }}>
              <Gauge className="h-3.5 w-3.5" />{health.band.label}
            </div>
            <p className="mt-2.5 max-w-[15rem] text-[12px] leading-relaxed text-ink3">A blend of your revenue, customer growth, loyalty and booking performance.</p>
          </div>
        </div>
        {/* category bars */}
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:border-l lg:border-line lg:pl-6">
          {health.categories.map((cat, i) => (
            <HealthBar key={cat.label} {...cat} delay={i * 0.08} live={totalBooked > 0} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function HealthBar({ label, score, tone, icon: Icon, delay, live }: { label: string; score: number; tone: Tone; icon: typeof DollarSign; delay: number; live: boolean }) {
  const t = TONE[tone];
  const s = live ? score : 0;
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-6 w-6 flex-none items-center justify-center rounded-lg", t.bubble)}><Icon className="h-3.5 w-3.5" /></span>
        <span className="text-[12.5px] font-semibold text-ink">{label}</span>
        <span className="ml-auto font-display text-[14px] font-bold tnum text-ink">{s}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line2">
        <motion.div className="h-full rounded-full" style={{ background: t.hex }} initial={{ width: 0 }} animate={{ width: `${s}%` }} transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </div>
  );
}

// ---- Revenue overview chart -----------------------------------------------
function RevenueOverview({ revenue, jobs }: { revenue: Point[]; jobs: Point[] }) {
  const data = revenue.map((r, i) => ({ label: r.label, revenue: r.value, jobs: jobs[i]?.value ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={264}>
      <ComposedChart data={data} margin={{ left: -8, right: 6, top: 10, bottom: 0 }}>
        <defs><linearGradient id="perfRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TONE.green.hex} stopOpacity={0.26} /><stop offset="100%" stopColor={TONE.green.hex} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke={AXIS} strokeOpacity={0.12} strokeDasharray="4 6" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} dy={6} />
        <YAxis yAxisId="rev" axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} width={50} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} />
        <YAxis yAxisId="jobs" orientation="right" axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} width={26} allowDecimals={false} />
        <Tooltip content={<ChartTip format={(v: number, n: string) => (n === "Revenue" ? money(v) : String(v))} />} cursor={{ stroke: TONE.green.hex, strokeOpacity: 0.2, strokeWidth: 1.5 }} />
        <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke={TONE.green.hex} strokeWidth={2.75} fill="url(#perfRev)" animationDuration={800} activeDot={{ r: 5, strokeWidth: 3, stroke: "rgb(var(--panel))", fill: TONE.green.hex }} />
        <Line yAxisId="jobs" type="monotone" dataKey="jobs" name="Jobs" stroke={TONE.blue.hex} strokeWidth={2} strokeDasharray="5 4" dot={false} animationDuration={800} activeDot={{ r: 4, strokeWidth: 3, stroke: "rgb(var(--panel))", fill: TONE.blue.hex }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function JobsBars({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -22, right: 6, top: 10, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={AXIS} strokeOpacity={0.12} strokeDasharray="4 6" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} dy={6} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} width={30} allowDecimals={false} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(46,123,255,.07)" }} />
        <Bar dataKey="value" name="Completed" fill={TONE.blue.hex} radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- 2 · Revenue breakdown -------------------------------------------------
function RevenueBreakdown({ services, total }: { services: { name: string; count: number; revenue: number }[]; total: number }) {
  const top = services.slice(0, 5);
  const rest = services.slice(5);
  const restRev = rest.reduce((s, x) => s + x.revenue, 0);
  const slices = [...top.map((s, i) => ({ name: s.name, value: s.revenue, count: s.count, color: SVC_COLORS[i] })),
    ...(restRev > 0 ? [{ name: "Other", value: restRev, count: rest.reduce((s, x) => s + x.count, 0), color: SVC_COLORS[5] }] : [])];
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-[168px] w-[168px] flex-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={3} cornerRadius={4} stroke="none" animationDuration={800}>
              {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <Tooltip content={<ChartTip format={(v: number) => money(v)} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[19px] font-bold leading-none tracking-tight tnum text-ink">{money(total)}</span>
          <span className="mt-1 text-[10.5px] text-ink3">booked</span>
        </div>
      </div>
      <div className="flex w-full flex-1 flex-col gap-2.5">
        {slices.map((s) => {
          const pct = total ? (s.value / total) * 100 : 0;
          return (
            <div key={s.name} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: s.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-ink">{s.name}</span>
                  <span className="ml-auto flex-none font-display text-[12.5px] font-bold tnum text-ink">{Math.round(pct)}%</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink3">
                  <span className="tnum">{money(s.value)}</span><span className="text-line2">·</span><span className="tnum">{s.count} {s.count === 1 ? "job" : "jobs"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- 4 · Appointment performance ------------------------------------------
function AppointmentPerformance({ d }: { d: { st: { completed: number; cancelled: number; no_show: number; active: number }; completionRate: number; avgTicketAll: number; totalBooked: number } }) {
  const slices = [
    { name: "Completed", value: d.st.completed, color: TONE.green.hex },
    { name: "Active", value: d.st.active, color: TONE.blue.hex },
    { name: "Cancelled", value: d.st.cancelled, color: "#8A94A6" },
    { name: "No-show", value: d.st.no_show, color: "#E5484D" },
  ].filter((s) => s.value > 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-5">
        <div className="relative h-[132px] w-[132px] flex-none">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={3} cornerRadius={4} stroke="none" animationDuration={800}>
                {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[22px] font-bold leading-none tracking-tight tnum text-ink">{Math.round(d.completionRate)}%</span>
            <span className="mt-1 text-[10px] text-ink3">completed</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {slices.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: s.color }} />
              <span className="truncate text-ink2">{s.name}</span>
              <b className="ml-auto tnum text-ink">{s.value}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
        <MiniStat label="Completed" value={String(d.st.completed)} tone="green" icon={CheckCircle2} />
        <MiniStat label="Cancelled" value={String(d.st.cancelled + d.st.no_show)} tone="orange" icon={XCircle} />
        <MiniStat label="Avg job" value={money(d.avgTicketAll)} tone="blue" icon={ReceiptText} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone, icon: Icon }: { label: string; value: string; tone: Tone; icon: typeof DollarSign }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <div className="flex items-center gap-1.5"><Icon className={cn("h-3.5 w-3.5", TONE[tone].text)} /><span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink3">{label}</span></div>
      <div className="mt-1.5 font-display text-[18px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
    </div>
  );
}

// ---- 3 · Customer retention ------------------------------------------------
function RetentionCard({ d, customers, rating, reviewsConnected }: {
  d: { repeatRate: number; repeatCount: number; newThisMonth: number; inactive: number; followUps: number }; customers: number; rating: number | null; reviewsConnected: boolean;
}) {
  const active = Math.max(0, customers - d.inactive);
  const activePct = customers ? (active / customers) * 100 : 0;
  return (
    <Panel title="Customer retention" subtitle="Who's loyal, and who to win back" icon={HeartHandshake}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RetentionTile tone="green" icon={Repeat} value={`${Math.round(d.repeatRate)}%`} label="Returning" hint={`${d.repeatCount} repeat`} />
        <RetentionTile tone="blue" icon={UserPlus} value={String(d.newThisMonth)} label="New this month" />
        <RetentionTile tone="orange" icon={Clock} value={String(d.followUps)} label="Need follow-up" hint="45–90 days" />
        <RetentionTile tone="purple" icon={CalendarX} value={String(d.inactive)} label="Inactive" hint="90+ days" />
      </div>
      {/* active vs at-risk bar */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[11.5px] text-ink3">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-success" />Active <b className="text-ink">{active}</b></span>
          <span className="inline-flex items-center gap-1.5"><b className="text-ink">{d.inactive}</b> At risk <span className="h-2 w-2 rounded-[3px] bg-warning" /></span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-line2">
          <div className="h-full bg-gradient-to-r from-success/80 to-success transition-[width] duration-700" style={{ width: `${activePct}%` }} />
          <div className="h-full flex-1 bg-warning/70" />
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink3">
          {rating != null
            ? <>Your Google rating is <b className="text-ink">{rating.toFixed(1)}★</b> — happy customers are your best marketing.</>
            : reviewsConnected === false
              ? <><Link to="/reviews" className="font-semibold text-brand-500 hover:underline">Connect Google reviews</Link> to track your reputation alongside retention.</>
              : <>Keeping customers coming back costs far less than finding new ones.</>}
        </p>
      </div>
    </Panel>
  );
}

function RetentionTile({ tone, icon: Icon, value, label, hint }: { tone: Tone; icon: typeof DollarSign; value: string; label: string; hint?: string }) {
  const t = TONE[tone];
  return (
    <div className="rounded-2xl bg-panel2/60 p-3.5 ring-1 ring-inset ring-line/60">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", t.bubble)}><Icon className="h-3.5 w-3.5" /></span>
      <div className="mt-2.5 font-display text-[22px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
      <div className="mt-1.5 text-[11px] font-medium text-ink2">{label}</div>
      {hint && <div className="text-[10.5px] text-ink3">{hint}</div>}
    </div>
  );
}

// ---- 5 · Growth comparison -------------------------------------------------
function ComparisonCard({ d }: { d: { revenueSeries: Point[]; newCustSeries: Point[]; completedSeries: Point[]; ticketSeries: Point[] } }) {
  const rows: { label: string; cur: number; prev: number; money?: boolean }[] = [
    { label: "Revenue", cur: last(d.revenueSeries), prev: prev(d.revenueSeries), money: true },
    { label: "New customers", cur: last(d.newCustSeries), prev: prev(d.newCustSeries) },
    { label: "Completed jobs", cur: last(d.completedSeries), prev: prev(d.completedSeries) },
    { label: "Avg ticket", cur: last(d.ticketSeries), prev: prev(d.ticketSeries), money: true },
  ];
  return (
    <Panel title="Performance over time" subtitle="This month vs last" icon={Activity}>
      <div className="flex flex-col divide-y divide-line2">
        {rows.map((r) => {
          const delta = r.prev > 0 ? ((r.cur - r.prev) / r.prev) * 100 : r.cur > 0 ? 100 : 0;
          const fmt = (n: number) => (r.money ? money(n) : String(Math.round(n)));
          return (
            <div key={r.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-ink">{r.label}</div>
                <div className="mt-0.5 text-[11px] text-ink3">was {fmt(r.prev)} last month</div>
              </div>
              <div className="font-display text-[16px] font-bold leading-none tnum text-ink">{fmt(r.cur)}</div>
              <Delta value={delta} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---- 6 · Growth opportunities (rule-based) --------------------------------
function GrowthOpportunities({ opps }: { opps: { icon: typeof Lightbulb; tone: Tone; text: React.ReactNode }[] }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="surface relative overflow-hidden rounded-[20px]">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-success/12 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-paint-gloss opacity-40" />
      <div className="relative flex h-full flex-col p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-success to-brand-500 text-white shadow-glow"><Lightbulb className="h-[18px] w-[18px]" /></span>
          <div><h2 className="font-display text-[16.5px] font-bold tracking-tight text-ink">Growth opportunities</h2><p className="mt-0.5 text-[12px] text-ink3">Spotted in your shop data</p></div>
        </div>
        {opps.length === 0 ? (
          <InlineEmpty
            icon={<Lightbulb />}
            title="Opportunities are on the way"
            body="Book a few jobs and log some invoices, and we'll surface concrete ways to grow — straight from your shop data."
            action={
              <Link to="/appointments" className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/15">
                <CalendarPlus className="h-4 w-4" />Book a job
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {opps.map((o, i) => {
              const t = TONE[o.tone]; const Icon = o.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.14 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-2.5 rounded-xl bg-panel2/50 px-3 py-2.5 ring-1 ring-inset ring-line/60 transition-colors duration-150 hover:bg-panel2">
                  <span className={cn("mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg", t.bubble)}><Icon className="h-3.5 w-3.5" /></span>
                  <p className="text-[12.5px] leading-relaxed text-ink2">{o.text}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
}

// ---- 7 · Shop level + milestones ------------------------------------------
function ShopLevelCard({ levelNum, title, completed, next, prog, achievements }: {
  levelNum: number; title: string; completed: number; next: { min: number; title: string } | null; prog: number;
  achievements: { label: string; icon: typeof Award; current: number; goal: number; money?: boolean }[];
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="surface relative overflow-hidden rounded-[22px]">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet/15 blur-[90px]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-paint-gloss opacity-40" />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-7">
          {/* level badge */}
          <div className="flex items-center gap-4 lg:w-[300px] lg:flex-none">
            <div className="relative flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-brand-600 text-white shadow-glow">
              <div aria-hidden className="absolute inset-0 rounded-2xl bg-paint-gloss opacity-40" />
              <Trophy className="relative h-7 w-7" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink3">Shop level {levelNum}</div>
              <div className="font-display text-[20px] font-bold tracking-tight text-ink">{title}</div>
              <div className="mt-1 text-[12px] text-ink3">{completed} details completed</div>
            </div>
          </div>
          {/* progress to next */}
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="font-semibold text-ink2">{next ? `Next: ${next.title}` : "Top level reached 🏆"}</span>
              {next && <span className="tnum text-ink3">{completed} / {next.min}</span>}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line2">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-violet to-brand-500" initial={{ width: 0 }} animate={{ width: `${prog * 100}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
            </div>
            {next && <div className="mt-1.5 text-[11.5px] text-ink3">{Math.max(0, next.min - completed)} more details to reach <b className="text-ink2">{next.title}</b>.</div>}
          </div>
        </div>
        {/* achievements */}
        <div className="mt-6 border-t border-line pt-5">
          <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3"><Award className="h-3.5 w-3.5" />Milestones</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {achievements.map((a) => <AchievementBadge key={a.label} {...a} />)}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function AchievementBadge({ label, icon: Icon, current, goal, money: isMoney }: { label: string; icon: typeof Award; current: number; goal: number; money?: boolean }) {
  const done = current >= goal;
  const prog = clamp(current / goal, 0, 1);
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-3.5 transition-colors", done ? "border-transparent bg-gradient-to-br from-brand-500/10 to-violet/10 ring-1 ring-inset ring-brand-500/20" : "border-line bg-panel2/40")}>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-xl", done ? "bg-gradient-to-br from-brand-500 to-violet text-white shadow-glow" : "bg-line2 text-ink3")}>
          {done ? <Icon className="h-[18px] w-[18px]" /> : <Lock className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className={cn("truncate text-[12.5px] font-semibold", done ? "text-ink" : "text-ink2")}>{label}</div>
          <div className="text-[10.5px] text-ink3">{done ? "Unlocked" : `${isMoney ? money(current) : Math.round(current)} / ${isMoney ? money(goal) : goal}`}</div>
        </div>
      </div>
      {!done && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line2">
          <div className="h-full rounded-full bg-brand-400/70 transition-[width] duration-700" style={{ width: `${prog * 100}%` }} />
        </div>
      )}
    </div>
  );
}

// ---- Team performance ------------------------------------------------------
function TeamPerformance({ rows, maxRev }: { rows: { user_id: string; name: string; role: Role; jobs: number; completed: number; rate: number; revenue: number; avg: number }[]; maxRev: number }) {
  return (
    <Panel title="Team performance" subtitle="Revenue and jobs per detailer" icon={Users}>
      <div className="flex flex-col divide-y divide-line2">
        {rows.map((r, i) => (
          <div key={r.user_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11px] font-bold uppercase", i === 0 && r.revenue > 0 ? "bg-gradient-to-br from-warning to-warning/70 text-white shadow-[0_4px_14px_-4px_rgba(224,138,0,0.55)]" : "bg-brand-500/10 text-brand-500")}>{r.name.slice(0, 2)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-semibold text-ink">{r.name}</span>
                {i === 0 && r.revenue > 0 && <span className="inline-flex flex-none items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-warning"><Trophy className="h-3 w-3" />Top</span>}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink3"><span className="tnum">{r.completed}/{r.jobs} jobs</span><span className="text-line2">·</span><span className="tnum">{r.jobs ? `${r.rate}% done` : "—"}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line2"><div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-700" style={{ width: `${maxRev ? (r.revenue / maxRev) * 100 : 0}%` }} /></div>
            </div>
            <div className="flex-none text-right"><div className="font-display text-[15px] font-bold leading-none tnum text-ink">{money(r.revenue)}</div><div className="mt-1 text-[10.5px] text-ink3">{r.completed ? `${money(r.avg)}/job` : ROLE_LABEL[r.role] ?? r.role}</div></div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

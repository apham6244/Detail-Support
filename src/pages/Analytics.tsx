import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, CheckCircle2, Repeat, Sparkles,
  Trophy, Flame, CalendarDays, Clock, Target, Wrench, Users, ArrowUpRight,
  CalendarPlus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SignInPrompt, EmptyState, InlineEmpty, money } from "@/components/ui/data";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";
import { Panel, Delta, ChartTip, KpiCard, MiniEmpty } from "@/components/ui/metric";
import { AXIS, TONE, lastMonths, monthKey, collected, pctDelta, type Tone, type Point } from "@/lib/metrics";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { FeatureLocked } from "@/components/UpgradeGate";
import { useCustomers } from "@/hooks/useCustomers";
import { useAppointments } from "@/hooks/useAppointments";
import { useInvoices } from "@/hooks/useInvoices";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/models";
import { cn } from "@/lib/cn";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  completed: "#17A867",
  scheduled: "#2E7BFF",
  confirmed: "#7A5BE0",
  in_progress: "#E08A00",
  cancelled: "#8A94A6",
  no_show: "#E5484D",
};

export default function Analytics() {
  const { org, role } = useAuth();
  const ent = useEntitlements();
  const { customers, loading: cL } = useCustomers();
  const { appointments, loading: aL } = useAppointments();
  const { invoices, loading: iL } = useInvoices();

  const months = useMemo(() => lastMonths(6), []);

  const d = useMemo(() => {
    // ---- monthly buckets ------------------------------------------------
    const revByMonth: Record<string, number> = {};
    const paidByMonth: Record<string, number> = {};
    for (const inv of invoices) {
      const k = monthKey(inv.issued_at || inv.created_at);
      const c = collected(inv);
      revByMonth[k] = (revByMonth[k] ?? 0) + c;
      if (c > 0) paidByMonth[k] = (paidByMonth[k] ?? 0) + 1;
    }
    const custByMonth: Record<string, number> = {};
    for (const c of customers) {
      const k = monthKey(c.created_at);
      custByMonth[k] = (custByMonth[k] ?? 0) + 1;
    }
    const apptByMonth: Record<string, { total: number; done: number }> = {};
    for (const a of appointments) {
      const k = monthKey(a.scheduled_at);
      const b = (apptByMonth[k] ??= { total: 0, done: 0 });
      b.total++;
      if (a.status === "completed") b.done++;
    }
    // repeat bookings = a customer's 2nd+ visit, bucketed by month
    const repeatByMonth: Record<string, number> = {};
    const seen = new Set<string>();
    for (const a of [...appointments].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))) {
      const k = monthKey(a.scheduled_at);
      if (seen.has(a.customer_id)) repeatByMonth[k] = (repeatByMonth[k] ?? 0) + 1;
      else seen.add(a.customer_id);
    }

    const revenueSeries: Point[] = months.map((m) => ({ label: m.label, value: revByMonth[m.key] ?? 0 }));
    const customerSeries: Point[] = months.map((m) => ({ label: m.label, value: custByMonth[m.key] ?? 0 }));
    const completionSeries: Point[] = months.map((m) => {
      const b = apptByMonth[m.key];
      return { label: m.label, value: b?.total ? (b.done / b.total) * 100 : 0 };
    });
    const repeatSeries: Point[] = months.map((m) => ({ label: m.label, value: repeatByMonth[m.key] ?? 0 }));
    const ticketSeries: Point[] = months.map((m) => {
      const r = revByMonth[m.key] ?? 0;
      const n = paidByMonth[m.key] ?? 0;
      return { label: m.label, value: n ? r / n : 0 };
    });

    // ---- headline numbers -----------------------------------------------
    const thisMonthRev = revenueSeries[revenueSeries.length - 1].value;
    const lastMonthRev = revenueSeries[revenueSeries.length - 2]?.value ?? 0;
    const totalCollected = invoices.reduce((s, inv) => s + collected(inv), 0);
    const paidCount = invoices.filter((i) => collected(i) > 0).length;
    const avgTicket = paidCount ? totalCollected / paidCount : 0;

    const statusCounts: Partial<Record<AppointmentStatus, number>> = {};
    for (const a of appointments) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
    const donut = (Object.keys(statusCounts) as AppointmentStatus[])
      .map((s) => ({ name: APPOINTMENT_STATUS_LABEL[s], value: statusCounts[s]!, color: STATUS_COLOR[s] }))
      .sort((a, b) => b.value - a.value);
    const done = statusCounts.completed ?? 0;
    const completionRate = appointments.length ? (done / appointments.length) * 100 : 0;

    const perCust: Record<string, number> = {};
    for (const a of appointments) perCust[a.customer_id] = (perCust[a.customer_id] ?? 0) + 1;
    const repeatCount = Object.values(perCust).filter((n) => n >= 2).length;
    const repeatRate = customers.length ? (repeatCount / customers.length) * 100 : 0;

    // ---- services --------------------------------------------------------
    const svc: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const a of appointments) {
      const name = a.service?.name ?? "Other / walk-in";
      (svc[name] ??= { name, count: 0, revenue: 0 });
      svc[name].count += 1;
      svc[name].revenue += a.price ?? 0;
    }
    const allServices = Object.values(svc);
    const topServices = [...allServices].sort((a, b) => b.count - a.count).slice(0, 5);
    const maxSvc = topServices.reduce((m, s) => Math.max(m, s.count), 0);
    const topEarner = [...allServices].sort((a, b) => b.revenue - a.revenue)[0] ?? null;

    // ---- day of week ------------------------------------------------------
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const a of appointments) dayCounts[new Date(a.scheduled_at).getDay()]++;
    const byDay = DAYS.map((label, i) => ({ label, value: dayCounts[i] }));
    const busiest = byDay.reduce((m, x) => (x.value > m.value ? x : m), byDay[0]);

    // ---- retention: served before, nothing booked, >90 days quiet ---------
    const now = Date.now();
    const lastDone: Record<string, number> = {};
    const upcoming = new Set<string>();
    for (const a of appointments) {
      const t = new Date(a.scheduled_at).getTime();
      if (a.status === "completed") lastDone[a.customer_id] = Math.max(lastDone[a.customer_id] ?? 0, t);
      if ((a.status === "scheduled" || a.status === "confirmed") && t >= now) upcoming.add(a.customer_id);
    }
    const overdue = Object.entries(lastDone)
      .filter(([id, t]) => !upcoming.has(id) && now - t > 90 * 86_400_000).length;

    // ---- pace -------------------------------------------------------------
    const nowD = new Date();
    const dayOfMonth = nowD.getDate();
    const daysInMonth = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
    const pace = dayOfMonth > 0 ? (thisMonthRev / dayOfMonth) * daysInMonth : 0;

    return {
      revenueSeries, customerSeries, completionSeries, repeatSeries, ticketSeries,
      thisMonthRev, lastMonthRev, totalCollected, avgTicket,
      donut, completionRate, done, topServices, maxSvc, topEarner, allServices,
      repeatCount, repeatRate, byDay, busiest, overdue, pace, dayOfMonth, daysInMonth,
      totalBookings: appointments.length,
    };
  }, [customers, appointments, invoices, months]);

  // ---- derived insights (all computed from real data, never invented) ----
  const insights = useMemo(() => {
    const out: { icon: typeof Sparkles; tone: Tone; text: React.ReactNode }[] = [];
    const revDelta = pctDelta(d.revenueSeries);

    if (d.lastMonthRev > 0) {
      const up = revDelta >= 0;
      out.push({
        icon: up ? TrendingUp : TrendingDown,
        tone: up ? "green" : "orange",
        text: <>Revenue is <b className={up ? "text-success" : "text-warning"}>{up ? "up" : "down"} {Math.abs(Math.round(revDelta))}%</b> this month vs last.</>,
      });
    }
    if (d.topEarner && d.topEarner.revenue > 0) {
      out.push({
        icon: Trophy, tone: "purple",
        text: <>Your most profitable service is <b className="text-ink">{d.topEarner.name}</b> at {money(d.topEarner.revenue)}.</>,
      });
    }
    if (d.busiest && d.busiest.value > 0) {
      out.push({
        icon: CalendarDays, tone: "blue",
        text: <><b className="text-ink">{d.busiest.label}</b> is your busiest day — {d.busiest.value} bookings.</>,
      });
    }
    const tDelta = pctDelta(d.ticketSeries);
    if ((d.ticketSeries[d.ticketSeries.length - 2]?.value ?? 0) > 0) {
      const up = tDelta >= 0;
      out.push({
        icon: Sparkles, tone: up ? "green" : "orange",
        text: <>Average ticket has {up ? "risen" : "dipped"} <b className={up ? "text-success" : "text-warning"}>{Math.abs(Math.round(tDelta))}%</b> to {money(d.ticketSeries[d.ticketSeries.length - 1].value)}.</>,
      });
    }
    if (d.overdue > 0) {
      out.push({
        icon: Clock, tone: "orange",
        text: <><b className="text-ink">{d.overdue}</b> {d.overdue === 1 ? "customer is" : "customers are"} overdue for maintenance — no visit in 90+ days.</>,
      });
    }
    if (d.dayOfMonth >= 5 && d.lastMonthRev > 0) {
      const ahead = d.pace >= d.lastMonthRev;
      out.push({
        icon: Target, tone: ahead ? "green" : "blue",
        text: <>On pace for <b className="text-ink">{money(d.pace)}</b> this month — {ahead ? "ahead of" : "behind"} last month's {money(d.lastMonthRev)}.</>,
      });
    }
    return out.slice(0, 5);
  }, [d]);

  // ---- gates (unchanged) -------------------------------------------------
  if (!org) return <SignInPrompt what="analytics" />;

  if (role === "employee") {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Analytics" subtitle="Shop performance" />
        <EmptyState art="chart" title="Analytics is for owners and admins"
          body="Revenue and performance reports aren't available to Detailer accounts." />
      </div>
    );
  }
  if (ent.loading) return <PageSkeleton variant="analytics" kpis={4} />;
  if (!ent.hasFeature("analytics")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Analytics" subtitle="Shop performance" />
        <FeatureLocked feature="analytics" title="Analytics"
          description="Track revenue trends, appointment completion, top services, repeat customers, and monthly growth." />
      </div>
    );
  }
  if (cL && aL && iL && !customers.length && !appointments.length && !invoices.length) return <PageSkeleton variant="analytics" kpis={4} />;

  const hasAppts = appointments.length > 0;
  const revDelta = pctDelta(d.revenueSeries);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Analytics" subtitle="Revenue, bookings, and growth · last 6 months" />

      {/* ---- Headline metrics ------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} tone="green" icon={DollarSign} label="Revenue this month"
          value={d.thisMonthRev} format={money} delta={revDelta} sub="vs last month"
          series={d.revenueSeries} />
        <KpiCard index={1} tone="blue" icon={CheckCircle2} label="Completion rate"
          value={d.completionRate} format={(n) => `${Math.round(n)}%`} delta={pctDelta(d.completionSeries)}
          sub={`${d.done} completed`} series={d.completionSeries} />
        <KpiCard index={2} tone="purple" icon={Repeat} label="Repeat customers"
          value={d.repeatCount} format={(n) => String(Math.round(n))} delta={pctDelta(d.repeatSeries)}
          sub={`${Math.round(d.repeatRate)}% of clients`} series={d.repeatSeries} />
        <KpiCard index={3} tone="orange" icon={Sparkles} label="Average ticket"
          value={d.avgTicket} format={money} delta={pctDelta(d.ticketSeries)}
          sub={`${money(d.totalCollected)} collected`} series={d.ticketSeries} />
      </div>

      {/* ---- Revenue trend + AI insights -------------------------------- */}
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Revenue trend" subtitle="Collected per month"
          badge={<Delta value={revDelta} />}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={d.revenueSeries} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#17A867" stopOpacity={0.26} />
                  <stop offset="100%" stopColor="#17A867" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={AXIS} strokeOpacity={0.12} strokeDasharray="4 6" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} dy={6} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} width={52}
                tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} />
              <Tooltip content={<ChartTip format={money} />} cursor={{ stroke: "#17A867", strokeOpacity: 0.25, strokeWidth: 1.5 }} />
              <Area type="monotone" dataKey="value" name="Revenue" stroke="#17A867" strokeWidth={2.75}
                fill="url(#revFill)" animationDuration={800}
                activeDot={{ r: 5, strokeWidth: 3, stroke: "rgb(var(--panel))", fill: "#17A867" }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <InsightsCard insights={insights} />
      </div>

      {/* ---- Top services + completion ---------------------------------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Top services" subtitle="Ranked by bookings">
          {d.topServices.length === 0 ? (
            <MiniEmpty text="No booked services yet." />
          ) : (
            <div className="flex flex-col gap-1.5">
              {d.topServices.map((s, i) => (
                <ServiceRow key={s.name} rank={i + 1} service={s} max={d.maxSvc}
                  total={d.totalBookings} isTopEarner={d.topEarner?.name === s.name} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Appointment completion" subtitle="By status">
          {!hasAppts ? (
            <MiniEmpty text="No appointments yet." />
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col">
              <div className="relative h-[150px] w-[150px] flex-none">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={d.donut} dataKey="value" innerRadius={50} outerRadius={70}
                      paddingAngle={3} cornerRadius={4} stroke="none" animationDuration={800}>
                      {d.donut.map((x) => <Cell key={x.name} fill={x.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <CountUp value={d.completionRate} format={(n) => `${Math.round(n)}%`}
                    className="font-display text-[26px] font-bold leading-none tracking-tight tnum text-ink" />
                  <span className="mt-1 text-[11px] text-ink3">completed</span>
                </div>
              </div>
              <div className="flex w-full flex-1 flex-col gap-2">
                {d.donut.map((x) => (
                  <div key={x.name} className="flex items-center gap-2 text-[12.5px]">
                    <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: x.color }} />
                    <span className="truncate text-ink2">{x.name}</span>
                    <b className="ml-auto tnum text-ink">{x.value}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ---- New customers + busiest days ------------------------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="New customers" subtitle="Added per month" icon={Users}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.customerSeries} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={AXIS} strokeOpacity={0.12} strokeDasharray="4 6" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} dy={6} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} width={30} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(126,138,163,.07)" }} />
              <Bar dataKey="value" name="New customers" fill="#7A5BE0" radius={[6, 6, 0, 0]} maxBarSize={38} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Busiest days" subtitle="Bookings by day of week" icon={Flame}
          badge={d.busiest?.value ? <Pill tone="blue">{d.busiest.label} leads</Pill> : undefined}>
          {!hasAppts ? (
            <MiniEmpty text="No appointments yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.byDay} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={AXIS} strokeOpacity={0.12} strokeDasharray="4 6" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} width={30} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(126,138,163,.07)" }} />
                <Bar dataKey="value" name="Bookings" radius={[6, 6, 0, 0]} maxBarSize={34} animationDuration={800}>
                  {d.byDay.map((x) => (
                    <Cell key={x.label} fill={x.label === d.busiest?.label ? "#2E7BFF" : "rgba(46,123,255,0.28)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** A premium card shell: gloss sheen, soft shadow, generous radius. */
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", TONE[tone].bubble)}>
      {children}
    </span>
  );
}

/** Premium tooltip shared by every chart. */
function ServiceRow({ rank, service, max, total, isTopEarner }: {
  rank: number; service: { name: string; count: number; revenue: number };
  max: number; total: number; isTopEarner: boolean;
}) {
  const pct = total ? (service.count / total) * 100 : 0;
  const bar = max ? (service.count / max) * 100 : 0;
  return (
    <div className="group/row flex items-center gap-3.5 rounded-2xl px-2.5 py-2.5 transition-colors duration-150 hover:bg-panel2/60">
      <span className={cn(
        "flex h-9 w-9 flex-none items-center justify-center rounded-xl font-display text-[14px] font-bold tnum",
        rank === 1
          ? "bg-gradient-to-br from-warning to-warning/70 text-white shadow-[0_4px_14px_-4px_rgba(224,138,0,0.6)]"
          : "bg-line2 text-ink3"
      )}>
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[13.5px] font-semibold text-ink">{service.name}</span>
          {rank === 1 && <Badge tone="blue" icon={Flame}>Most booked</Badge>}
          {isTopEarner && <Badge tone="green" icon={Trophy}>Top performer</Badge>}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink3">
          <Wrench className="h-3 w-3" />
          {service.count} {service.count === 1 ? "booking" : "bookings"}
          <span className="text-line2">·</span>
          {money(service.revenue)}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line2">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-700"
            style={{ width: `${bar}%` }} />
        </div>
      </div>

      <div className="flex-none text-right">
        <div className="font-display text-[15px] font-bold leading-none tnum text-ink">{Math.round(pct)}%</div>
        <div className="mt-1 text-[10.5px] text-ink3">of bookings</div>
      </div>
    </div>
  );
}

function Badge({ tone, icon: Icon, children }: { tone: Tone; icon: typeof Trophy; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em]", TONE[tone].bubble)}>
      <Icon className="h-3 w-3" />{children}
    </span>
  );
}

function InsightsCard({ insights }: { insights: { icon: typeof Sparkles; tone: Tone; text: React.ReactNode }[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="surface relative overflow-hidden rounded-[20px]"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-paint-gloss opacity-40" />

      <div className="relative p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet text-white shadow-glow">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="font-display text-[16.5px] font-bold tracking-tight text-ink">AI Business Insights</h2>
            <p className="mt-0.5 text-[12px] text-ink3">Generated from your live shop data</p>
          </div>
        </div>

        {insights.length === 0 ? (
          <InlineEmpty
            icon={<Sparkles />}
            title="Insights are on the way"
            body="Book a few jobs and log some invoices, and clear takeaways about your revenue and customers will appear here automatically."
            action={
              <Link to="/appointments" className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/15">
                <CalendarPlus className="h-4 w-4" />Book a job
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {insights.map((ins, i) => {
              const t = TONE[ins.tone];
              const Icon = ins.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.14 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className="group/i flex items-start gap-2.5 rounded-xl bg-panel2/50 px-3 py-2.5 ring-1 ring-inset ring-line/60 transition-colors duration-150 hover:bg-panel2"
                >
                  <span className={cn("mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg", t.bubble)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[12.5px] leading-relaxed text-ink2">{ins.text}</p>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-[11px] text-ink3">
          <ArrowUpRight className="h-3 w-3" />
          Updates automatically as jobs and invoices come in.
        </div>
      </div>
    </motion.section>
  );
}

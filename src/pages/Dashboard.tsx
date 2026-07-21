import { useId, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import {
  CalendarClock,
  CalendarPlus,
  Car,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Wallet,
  Users,
  UserPlus,
  Star,
  Sparkles,
  Gauge,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Send,
  Clock,
  BellRing,
  type LucideIcon,
} from "lucide-react";
import { SignInPrompt, money } from "@/components/ui/data";
import { EmptyArt } from "@/components/ui/EmptyArt";
import { DetailImage } from "@/components/ui/DetailImage";
import { CountUp } from "@/components/ui/CountUp";
import { Skeleton, SkeletonTiles } from "@/components/ui/Skeleton";
import { PHOTO, unsplash } from "@/lib/imagery";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCustomers } from "@/hooks/useCustomers";
import { useAppointments } from "@/hooks/useAppointments";
import { useInvoices } from "@/hooks/useInvoices";
import {
  vehicleLabel,
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
  type Appointment,
} from "@/lib/models";
import { cn } from "@/lib/cn";

type Accent = "brand" | "success" | "violet" | "warning";

const ACCENT_BUBBLE: Record<Accent, string> = {
  brand: "bg-brand-500/12 text-brand-500 ring-brand-500/15",
  success: "bg-success/12 text-success ring-success/15",
  violet: "bg-violet/12 text-violet ring-violet/15",
  warning: "bg-warning/12 text-warning ring-warning/15",
};

const APPT_BADGE: Record<AppointmentStatus, string> = {
  scheduled: "bg-brand-500/10 text-brand-500",
  confirmed: "bg-violet/10 text-violet",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-ink3/10 text-ink3",
  no_show: "bg-danger/10 text-danger",
};
const APPT_DOT: Record<AppointmentStatus, string> = {
  scheduled: "bg-brand-500",
  confirmed: "bg-violet",
  in_progress: "bg-warning",
  completed: "bg-success",
  cancelled: "bg-ink3",
  no_show: "bg-danger",
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid rgba(126,138,163,.25)",
  background: "rgb(var(--panel))",
  color: "rgb(var(--ink))",
  fontSize: 12,
  boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)",
};

export default function Dashboard() {
  const { org, profile, role } = useAuth();
  const { ws } = useWorkspace();
  const { customers, loading: cL } = useCustomers();
  const { appointments, loading: aL } = useAppointments();
  const { invoices, loading: iL } = useInvoices();

  const m = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTomorrow = new Date(startToday.getTime() + 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isToday = (iso: string) => {
      const d = new Date(iso);
      return d >= startToday && d < startTomorrow;
    };
    const inThisMonth = (iso: string) => new Date(iso) >= monthStart;

    // --- Today's schedule ---
    const todays = appointments
      .filter((a) => isToday(a.scheduled_at) && a.status !== "cancelled")
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    const upcomingToday = todays.filter((a) => a.status === "scheduled" || a.status === "confirmed").length;
    const inProgress = todays.filter((a) => a.status === "in_progress").length;
    const completedToday = todays.filter((a) => a.status === "completed").length;

    // --- Revenue ---
    const collected = (inv: (typeof invoices)[number]) =>
      inv.status === "paid" ? inv.total : inv.status === "deposit_paid" ? inv.deposit_amount : 0;
    const monthlyRevenue = invoices.reduce(
      (s, inv) => (inThisMonth(inv.issued_at || inv.created_at) ? s + collected(inv) : s),
      0
    );
    const todayRevenue = invoices.reduce(
      (s, inv) => (isToday(inv.issued_at || inv.created_at) ? s + collected(inv) : s),
      0
    );
    const totalCollected = invoices.reduce((s, inv) => s + collected(inv), 0);
    const completedServicesMonth = appointments.filter(
      (a) => a.status === "completed" && inThisMonth(a.scheduled_at)
    ).length;
    const avgCustomerValue = customers.length ? totalCollected / customers.length : 0;

    // 6-month revenue series (labelled, for the trend chart)
    const revSeries: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const value = invoices.reduce((s, inv) => {
        const t = new Date(inv.issued_at || inv.created_at);
        return t >= d && t < next ? s + collected(inv) : s;
      }, 0);
      revSeries.push({ label: d.toLocaleDateString(undefined, { month: "short" }), value });
    }
    const thisMonthRev = revSeries[5].value;
    const lastMonthRev = revSeries[4].value;
    const revenueGrowth =
      lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : thisMonthRev > 0 ? 100 : 0;
    const hasRevenue = revSeries.some((r) => r.value > 0);

    // --- Customers ---
    const apptsByCustomer: Record<string, number> = {};
    for (const a of appointments) apptsByCustomer[a.customer_id] = (apptsByCustomer[a.customer_id] ?? 0) + 1;
    const returning = Object.values(apptsByCustomer).filter((n) => n >= 2).length;
    const newThisMonth = customers.filter((c) => inThisMonth(c.created_at)).length;

    // --- Performance ---
    const completedAll = appointments.filter((a) => a.status === "completed").length;
    const totalAppts = appointments.length;
    const completionRate = totalAppts ? Math.round((completedAll / totalAppts) * 100) : 0;

    // --- Needs attention: things that cost money if ignored ---
    const nowMs = Date.now();
    const balanceOf = (inv: (typeof invoices)[number]) =>
      Math.max(0, inv.total - (inv.status === "paid" ? inv.total : inv.status === "deposit_paid" ? inv.deposit_amount : 0));
    let overdueCount = 0;
    let overdueAmount = 0;
    let unsentCount = 0;
    for (const inv of invoices) {
      const bal = balanceOf(inv);
      if (bal <= 0.005) continue;
      if (inv.due_at && new Date(inv.due_at).getTime() < nowMs) {
        overdueCount += 1;
        overdueAmount += bal;
      }
      if (!inv.sent_at) unsentCount += 1;
    }

    // Customers served before, nothing booked, quiet for 60+ days.
    const lastDone: Record<string, number> = {};
    const hasUpcoming = new Set<string>();
    for (const a of appointments) {
      const t = new Date(a.scheduled_at).getTime();
      if (a.status === "completed") lastDone[a.customer_id] = Math.max(lastDone[a.customer_id] ?? 0, t);
      if ((a.status === "scheduled" || a.status === "confirmed") && t >= nowMs) hasUpcoming.add(a.customer_id);
    }
    const lapsedCount = Object.entries(lastDone)
      .filter(([id, t]) => !hasUpcoming.has(id) && nowMs - t > 60 * 86_400_000).length;

    // Today's jobs still sitting unconfirmed.
    const unconfirmedToday = todays.filter((a) => a.status === "scheduled").length;

    return {
      todays,
      upcomingToday,
      inProgress,
      completedToday,
      monthlyRevenue,
      todayRevenue,
      completedServicesMonth,
      avgCustomerValue,
      revSeries,
      revenueGrowth,
      hasRevenue,
      returning,
      newThisMonth,
      completedAll,
      totalAppts,
      completionRate,
      overdueCount,
      overdueAmount,
      unsentCount,
      lapsedCount,
      unconfirmedToday,
    };
  }, [appointments, invoices, customers]);

  if (!org) return <SignInPrompt what="dashboard" />;
  if (cL && aL && iL && !customers.length && !appointments.length && !invoices.length) {
    return (
      <div className="animate-fade-up flex flex-col gap-5">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <SkeletonTiles count={4} />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const firstName = (profile?.full_name || ws?.settings.owner_name || "").trim().split(" ")[0];
  const businessName = org.name || ws?.name || "Your shop";
  const greeting =
    new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const showRevenue = role !== "employee";
  const canInvoice = role === "owner" || role === "admin";
  const showStats = showRevenue && (customers.length > 0 || invoices.length > 0);
  const showInsights = showRevenue && m.hasRevenue;

  return (
    <div className="animate-fade-up">
      {/* Premium command-center hero */}
      <div className="relative min-h-[210px] overflow-hidden rounded-2xl shadow-hero-dark sm:min-h-[236px]">
        <DetailImage
          src={unsplash(PHOTO.glossyBlack, { w: 1600, q: 60 })}
          alt="Freshly detailed car with a deep gloss finish"
          className="absolute inset-0"
          eager
        />
        <div className="absolute inset-0 bg-gradient-to-r from-carbon-950 via-carbon-950/85 to-carbon-950/25" />
        <div className="absolute inset-0 bg-paint-gloss opacity-70" />
        <div className="relative px-5 py-7 sm:px-9 sm:py-9">
          <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.15em] text-brand-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
            </span>
            {businessName}
            <span className="text-white/40">·</span>
            <span className="text-white/70">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </span>
          </div>
          <h1 className="font-display mt-2.5 max-w-xl text-[27px] font-extrabold leading-[1.06] text-white sm:text-[34px]">
            {greeting}
            {firstName ? `, ${firstName}` : ""} <span className="align-middle">👋</span>
          </h1>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <HeroStat icon={CalendarClock} label="Today's jobs" value={m.todays.length} />
            {showRevenue && <HeroStat icon={DollarSign} label="Today's revenue" value={m.todayRevenue} money />}
            <HeroStat icon={CheckCircle2} label="Completed today" value={m.completedToday} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {canInvoice ? (
              <>
                <HeroAction to="/appointments" icon={CalendarPlus} label="New appointment" primary />
                <HeroAction to="/customers" icon={UserPlus} label="Add customer" />
                <HeroAction to="/invoices" icon={FileText} label="New invoice" />
              </>
            ) : (
              <HeroAction to="/schedule" icon={CalendarPlus} label="My schedule" primary />
            )}
          </div>
        </div>
      </div>

      {/* Needs attention — only appears when something actually needs doing */}
      <NeedsAttention
        overdueCount={m.overdueCount}
        overdueAmount={m.overdueAmount}
        unsentCount={m.unsentCount}
        lapsedCount={m.lapsedCount}
        unconfirmedToday={m.unconfirmedToday}
        showMoney={showRevenue}
      />

      {/* This month — engaging animated stat cards */}
      {showStats && (
        <div className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard index={0} accent="success" icon={DollarSign} label="Revenue this month" value={m.monthlyRevenue} isMoney trend={m.revenueGrowth} />
          <StatCard index={1} accent="brand" icon={CheckCircle2} label="Completed jobs" value={m.completedServicesMonth} sub="this month" />
          <StatCard index={2} accent="violet" icon={Wallet} label="Avg. ticket" value={m.avgCustomerValue} isMoney sub="per customer" />
          <StatCard index={3} accent="warning" icon={Users} label="Customers" value={customers.length} sub={`${m.newThisMonth} new this month`} />
        </div>
      )}

      {/* Command center — schedule feed alongside the money widgets */}
      <div className={cn("mt-3.5 grid gap-3.5", showInsights && "lg:grid-cols-[1.6fr_1fr]")}>
        <ScheduleWidget
          todays={m.todays}
          inProgress={m.inProgress}
          completedToday={m.completedToday}
          canInvoice={canInvoice}
        />
        {showInsights && (
          <div className="flex flex-col gap-3.5">
            <RevenueWidget series={m.revSeries} total={m.monthlyRevenue} growth={m.revenueGrowth} />
            <CompletionWidget rate={m.completionRate} completed={m.completedAll} total={m.totalAppts} />
          </div>
        )}
      </div>

      {/* Grow your business */}
      <section className="mt-6">
        <h2 className="mb-3.5 font-display text-[18px] font-bold tracking-tight text-ink">Grow your business</h2>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <GrowthCard icon={Gauge} title="Performance" stat={`${m.completionRate}%`} sub="Job completion rate" to="/analytics" />
          <GrowthCard icon={Star} title="Reviews" body="Collect Google reviews after every detail and show off your best work to win more bookings." soon />
          <GrowthCard icon={Sparkles} title="Leads" body="Capture inquiries from your site and turn them into booked details — automatically." soon />
        </div>
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- widgets

/** Card shell with an optional header — the base for every dashboard widget. */
function Widget({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  index = 0,
  children,
}: {
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  index?: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      className={cn("surface flex flex-col overflow-hidden rounded-2xl", className)}
    >
      {(title || action) && (
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-[12px] text-ink3">{subtitle}</p>}
          </div>
          {action && <div className="ml-auto flex-none">{action}</div>}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </motion.div>
  );
}

/** An animated, premium stat card with a counter and an optional trend chip. */
function StatCard({
  icon: Icon,
  label,
  value,
  isMoney,
  accent,
  trend,
  sub,
  index,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  isMoney?: boolean;
  accent: Accent;
  trend?: number;
  sub?: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
      className="surface gloss-card group rounded-2xl p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset", ACCENT_BUBBLE[accent])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {trend !== undefined && <TrendChip value={trend} />}
      </div>
      <div className="mt-3 font-display text-[26px] font-bold leading-none tracking-tight tnum text-ink">
        <CountUp value={value} format={isMoney ? (n) => money(Math.round(n)) : undefined} />
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-ink2">{label}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-ink3">{sub}</div>}
    </motion.div>
  );
}

function TrendChip({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tnum",
        up ? "bg-success/12 text-success" : "bg-danger/12 text-danger"
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {Math.round(value)}%
    </span>
  );
}

function ScheduleWidget({
  todays,
  inProgress,
  completedToday,
  canInvoice,
}: {
  todays: Appointment[];
  inProgress: number;
  completedToday: number;
  canInvoice: boolean;
}) {
  return (
    <Widget
      index={0}
      title="Today's schedule"
      subtitle={
        todays.length === 0
          ? "Nothing booked yet"
          : `${todays.length} ${todays.length === 1 ? "job" : "jobs"} · ${inProgress} in progress · ${completedToday} done`
      }
      action={
        <Link
          to="/appointments"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-500 transition-colors hover:text-brand-600"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
      bodyClassName="p-2 sm:p-2.5"
    >
      {todays.length === 0 ? (
        <DashEmpty
          title="No appointments scheduled yet"
          body="Your workday shows up here — customer, vehicle, service, time, and status for every job. Book a detail to get rolling."
          cta={canInvoice ? { to: "/appointments", label: "Book your first appointment" } : undefined}
        />
      ) : (
        <div className="flex flex-col">
          {todays.map((a, i) => (
            <ApptRow key={a.id} appt={a} index={i} />
          ))}
        </div>
      )}
    </Widget>
  );
}

function ApptRow({ appt, index }: { appt: Appointment; index: number }) {
  const price = appt.price;
  const time = fmtTime(appt.scheduled_at);
  const [clock, meridiem] = time.split(" ");
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.12 + index * 0.05, ease: "easeOut" }}
      className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-panel2/70"
    >
      {/* time badge */}
      <div className="flex h-12 w-14 flex-none flex-col items-center justify-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/10">
        <span className="text-[13px] font-bold leading-none tnum">{clock}</span>
        {meridiem && <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wide text-brand-500/70">{meridiem}</span>}
      </div>
      {/* vehicle indicator */}
      <div className="hidden h-10 w-10 flex-none items-center justify-center rounded-lg bg-line2 text-ink3 sm:flex">
        <Car className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 flex-none rounded-full", APPT_DOT[appt.status])} />
          <span className="truncate text-[13.5px] font-semibold text-ink">{appt.customer?.name ?? "Customer"}</span>
        </div>
        <div className="mt-0.5 truncate pl-3.5 text-xs text-ink3">
          {appt.vehicle ? vehicleLabel(appt.vehicle) : "Vehicle"}
          {appt.service?.name ? ` · ${appt.service.name}` : ""}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", APPT_BADGE[appt.status])}>
          {APPOINTMENT_STATUS_LABEL[appt.status]}
        </span>
        {typeof price === "number" && price > 0 && (
          <span className="text-[12px] font-semibold tnum text-ink2">{money(price)}</span>
        )}
      </div>
    </motion.div>
  );
}

function RevenueWidget({
  series,
  total,
  growth,
}: {
  series: { label: string; value: number }[];
  total: number;
  growth: number;
}) {
  const gradId = useId().replace(/[:]/g, "");
  return (
    <Widget index={1} title="Revenue trend" subtitle="Last 6 months">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-display text-[22px] font-bold leading-none tnum text-ink">
            <CountUp value={total} format={(n) => money(Math.round(n))} />
          </div>
          <div className="mt-1 text-[11.5px] text-ink3">collected this month</div>
        </div>
        <TrendChip value={growth} />
      </div>
      <div className="mt-3 h-[112px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 6, right: 2, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#17A867" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#17A867" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7E8AA3", fontSize: 10 }} interval={0} dy={4} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(126,138,163,.3)", strokeDasharray: "3 3" }} formatter={(v: number) => [money(v), "Revenue"]} />
            <Area type="monotone" dataKey="value" stroke="#17A867" strokeWidth={2.5} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Widget>
  );
}

function CompletionWidget({ rate, completed, total }: { rate: number; completed: number; total: number }) {
  return (
    <Widget index={2} title="Job completion" subtitle="All time">
      <div className="flex items-center gap-4">
        <Ring value={rate} />
        <div className="flex flex-col gap-1.5 text-[12.5px]">
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <span className="h-2 w-2 rounded-full bg-success" />
            {completed} completed
          </span>
          <span className="flex items-center gap-1.5 text-ink3">
            <span className="h-2 w-2 rounded-full bg-line2" />
            {Math.max(0, total - completed)} scheduled / other
          </span>
          <Link to="/analytics" className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-500 transition-colors hover:text-brand-600">
            Full analytics <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Widget>
  );
}

function Ring({ value, size = 92, stroke = 9 }: { value: number; size?: number; stroke?: number }) {
  const id = useId().replace(/[:]/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2E7BFF" />
            <stop offset="100%" stopColor="#7A5BE0" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[19px] font-bold leading-none tnum text-ink">{value}%</span>
        <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink3">done</span>
      </div>
    </div>
  );
}

/** A rich, intentional empty state with a subtle visual and a clear next step. */
function DashEmpty({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <EmptyArt variant="garage" className="w-[180px]" />
      <div>
        <div className="text-[14px] font-semibold text-ink">{title}</div>
        <div className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-ink3">{body}</div>
      </div>
      {cta && (
        <Link
          to={cta.to}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-4 text-[12.5px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.06] hover:shadow-glow-lg active:scale-[0.98]"
        >
          {cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  money: isMoney,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  money?: boolean;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-xl px-3.5 py-2.5">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/10 text-brand-200">
        <Icon className="h-4 w-4" />
      </span>
      <div className="leading-tight">
        <CountUp
          value={value}
          format={isMoney ? (n) => money(Math.round(n)) : undefined}
          className="font-display text-[18px] font-bold tnum text-white"
        />
        <div className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-white/55">{label}</div>
      </div>
    </div>
  );
}

function HeroAction({
  to,
  icon: Icon,
  label,
  primary,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-[38px] items-center gap-2 rounded-lg px-[15px] text-[13px] font-semibold tracking-[0.01em] transition-[transform,background-color,box-shadow,filter] duration-150 ease-out active:scale-[0.97]",
        primary
          ? "bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-glow hover:shadow-glow-lg hover:brightness-[1.05]"
          : "glass text-white hover:bg-white/[0.16]"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

/** A premium "grow your business" card — a live stat or a coming-soon preview. */
function GrowthCard({
  icon: Icon,
  title,
  stat,
  sub,
  body,
  to,
  soon,
}: {
  icon: LucideIcon;
  title: string;
  stat?: string;
  sub?: string;
  body?: string;
  to?: string;
  soon?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-violet/15 text-brand-500 ring-1 ring-inset ring-brand-500/10">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="text-[14px] font-semibold text-ink">{title}</span>
        {soon && (
          <span className="ml-auto rounded-full bg-line2 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-ink3">
            Soon
          </span>
        )}
        {to && !soon && (
          <ArrowRight className="ml-auto h-4 w-4 text-ink3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand-500" />
        )}
      </div>
      {stat && <div className="mt-3.5 font-display text-[26px] font-bold leading-none tracking-tight tnum text-ink">{stat}</div>}
      {sub && <div className="mt-1.5 text-[12.5px] text-ink3">{sub}</div>}
      {body && <p className="mt-3 text-[12.5px] leading-relaxed text-ink3">{body}</p>}
    </>
  );
  const cls = "surface gloss-card group flex flex-col rounded-2xl p-4 transition hover:border-brand-500/40 hover:shadow-lift";
  return to && !soon ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cn(cls, soon && "opacity-95")}>{inner}</div>
  );
}

// ---------------------------------------------------------------------------
// Needs attention — the one thing the dashboard was missing: what to DO today.
// Every item is derived from real data and only renders when it applies, so a
// healthy shop sees a calm "all clear" instead of a wall of empty warnings.
// ---------------------------------------------------------------------------

function NeedsAttention({
  overdueCount, overdueAmount, unsentCount, lapsedCount, unconfirmedToday, showMoney,
}: {
  overdueCount: number; overdueAmount: number; unsentCount: number;
  lapsedCount: number; unconfirmedToday: number; showMoney: boolean;
}) {
  const items: {
    tone: "danger" | "warning" | "brand" | "violet";
    icon: LucideIcon; title: string; detail: string; to: string; cta: string;
  }[] = [];

  if (showMoney && overdueCount > 0) {
    items.push({
      tone: "danger", icon: AlertCircle,
      title: `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`,
      detail: `${money(overdueAmount)} past due`,
      to: "/invoices", cta: "Chase payment",
    });
  }
  if (unconfirmedToday > 0) {
    items.push({
      tone: "warning", icon: Clock,
      title: `${unconfirmedToday} job${unconfirmedToday === 1 ? "" : "s"} unconfirmed`,
      detail: "On today's board", to: "/appointments", cta: "Confirm",
    });
  }
  if (showMoney && unsentCount > 0) {
    items.push({
      tone: "brand", icon: Send,
      title: `${unsentCount} invoice${unsentCount === 1 ? "" : "s"} not sent`,
      detail: "Customer hasn't been billed", to: "/invoices", cta: "Send",
    });
  }
  if (lapsedCount > 0) {
    items.push({
      tone: "violet", icon: BellRing,
      title: `${lapsedCount} client${lapsedCount === 1 ? "" : "s"} gone quiet`,
      detail: "No visit in 60+ days", to: "/customers", cta: "Win them back",
    });
  }

  if (items.length === 0) return null;

  const TONE = {
    danger:  { bubble: "bg-danger/12 text-danger",       ring: "ring-danger/20" },
    warning: { bubble: "bg-warning/12 text-warning",     ring: "ring-warning/20" },
    brand:   { bubble: "bg-brand-500/12 text-brand-500", ring: "ring-brand-500/20" },
    violet:  { bubble: "bg-violet/12 text-violet",       ring: "ring-violet/20" },
  } as const;

  return (
    <div className="mt-5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning/12 text-warning">
          <BellRing className="h-3.5 w-3.5" />
        </span>
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">Needs attention</h2>
        <span className="text-[12px] text-ink3">· {items.length}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((it, i) => {
          const t = TONE[it.tone];
          return (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={it.to}
                className={cn(
                  "surface group flex h-full items-start gap-3 rounded-2xl p-3.5 ring-1 ring-inset transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift",
                  t.ring
                )}
              >
                <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", t.bubble)}>
                  <it.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{it.title}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink3">{it.detail}</span>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-500">
                    {it.cta}
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

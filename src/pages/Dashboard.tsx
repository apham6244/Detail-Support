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
  Target,
  Trophy,
  Crown,
  Flame,
  Lightbulb,
  Repeat,
  ReceiptText,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { SignInPrompt, InlineEmpty, money } from "@/components/ui/data";
import { EmptyArt } from "@/components/ui/EmptyArt";
import { DetailImage } from "@/components/ui/DetailImage";
import { CountUp } from "@/components/ui/CountUp";
import { SkeletonHero, SkeletonKpiCards, SkeletonChartPanel, SkeletonDonutPanel } from "@/components/ui/Skeleton";
import { PHOTO, unsplash } from "@/lib/imagery";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCustomers } from "@/hooks/useCustomers";
import { useAppointments } from "@/hooks/useAppointments";
import { useInvoices } from "@/hooks/useInvoices";
import { useServices } from "@/hooks/useServices";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
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

/** Business-coach classification — a badge + its colour, so each tip reads like
 *  advice from an assistant (what kind, how urgent) rather than a flat line. */
type CoachBadge = "opportunity" | "warning" | "success" | "recommendation";
const BADGE: Record<CoachBadge, { label: string; cls: string }> = {
  opportunity:    { label: "Opportunity",    cls: "bg-violet/12 text-violet ring-violet/25" },
  warning:        { label: "Needs action",   cls: "bg-warning/12 text-warning ring-warning/25" },
  success:        { label: "On track",       cls: "bg-success/12 text-success ring-success/25" },
  recommendation: { label: "Tip",            cls: "bg-brand-500/12 text-brand-500 ring-brand-500/25" },
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
  const { services } = useServices();

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

  /**
   * Goals, coach insights, spotlight and the activity feed. Goals are AUTO-SET
   * from trailing performance (there's no goal field to store a target), so they
   * read as an ambitious-but-real pace rather than an arbitrary number.
   */
  const x = useMemo(() => {
    const now = new Date();
    const collected = (inv: (typeof invoices)[number]) =>
      inv.status === "paid" ? inv.total : inv.status === "deposit_paid" ? inv.deposit_amount : 0;

    // 6-month monthly counts for jobs + customers (revenue series already on m)
    const jobsByMonth: number[] = [];
    const custByMonth: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const n = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      jobsByMonth.push(appointments.filter((a) => a.status === "completed" && new Date(a.scheduled_at) >= d && new Date(a.scheduled_at) < n).length);
      custByMonth.push(customers.filter((c) => new Date(c.created_at) >= d && new Date(c.created_at) < n).length);
    }
    const best = (arr: number[]) => arr.reduce((a, b) => Math.max(a, b), 0);
    const thisRev = m.revSeries[5].value, lastRev = m.revSeries[4].value;
    const thisJobs = jobsByMonth[5], lastJobs = jobsByMonth[4];
    const thisCust = custByMonth[5], lastCust = custByMonth[4];

    // Targets are a ~15% stretch on LAST month (not this one) — a goal you work
    // toward, and can legitimately beat in a strong month. `best` keeps a floor
    // so a single quiet month doesn't make the target trivially easy.
    const revGoal = Math.max(500, Math.ceil(Math.max(lastRev * 1.15, best(m.revSeries.slice(0, 5).map((r) => r.value))) / 100) * 100);
    const jobsGoal = Math.max(5, Math.ceil(Math.max(lastJobs * 1.15, best(jobsByMonth.slice(0, 5)))));
    const custGoal = Math.max(3, Math.ceil(Math.max(lastCust * 1.2, best(custByMonth.slice(0, 5)))));
    // Month-to-date pace → a projected month-end total and an ETA. Cumulative
    // metrics (revenue/jobs/new customers) scale ~linearly across the month, so
    // dividing by the fraction of the month elapsed gives an honest forecast.
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const frac = dayOfMonth / daysInMonth;
    const forecast = (cur: number, goal: number) => {
      const remaining = Math.max(0, goal - cur);
      const projected = frac > 0 ? cur / frac : cur;
      if (cur >= goal) return { remaining: 0, projected, done: true, onTrack: true, earlyDays: 0 };
      const onTrack = projected >= goal;
      // day of month the goal is reached at the current daily rate
      const hitDay = cur > 0 ? (goal * dayOfMonth) / cur : Infinity;
      const earlyDays = Math.max(0, Math.round(daysInMonth - hitDay));
      return { remaining, projected, done: false, onTrack, earlyDays };
    };
    const goals = [
      { key: "rev", label: "Revenue goal", icon: DollarSign, cur: thisRev, goal: revGoal, money: true, tone: "green" as const, ...forecast(thisRev, revGoal) },
      { key: "jobs", label: "Jobs goal", icon: CheckCircle2, cur: thisJobs, goal: jobsGoal, money: false, tone: "blue" as const, ...forecast(thisJobs, jobsGoal) },
      { key: "cust", label: "New customers", icon: UserPlus, cur: thisCust, goal: custGoal, money: false, tone: "purple" as const, ...forecast(thisCust, custGoal) },
    ];

    // one motivational line — the nearest reachable goal
    const jobsLeft = Math.max(0, jobsGoal - thisJobs);
    const revLeft = Math.max(0, revGoal - thisRev);
    const custLeft = Math.max(0, custGoal - thisCust);
    let insight: string;
    if (thisRev >= revGoal && thisJobs >= jobsGoal) insight = "You've hit your monthly goals — outstanding month. 🏆";
    else if (jobsLeft > 0 && jobsLeft <= 4) insight = `You're only ${jobsLeft} ${jobsLeft === 1 ? "job" : "jobs"} away from your monthly target.`;
    else if (revLeft > 0 && revLeft <= revGoal * 0.35) insight = `Just ${money(revLeft)} to go to reach your revenue goal.`;
    else if (custLeft > 0 && custLeft <= 3) insight = `${custLeft} more new ${custLeft === 1 ? "customer" : "customers"} hits your growth goal.`;
    else insight = "You're building steady momentum this month.";

    // busiest / quietest weekday, top service (for the coach)
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const svc: Record<string, { count: number; revenue: number }> = {};
    for (const a of appointments) {
      dayCounts[new Date(a.scheduled_at).getDay()]++;
      if (a.status === "completed") {
        const nm = a.service?.name ?? "Service";
        (svc[nm] ??= { count: 0, revenue: 0 });
        svc[nm].count++; svc[nm].revenue += a.price ?? 0;
      }
    }
    const busiestDay = dayCounts.some((n) => n > 0) ? dayNames[dayCounts.indexOf(best(dayCounts))] : null;
    const topSvc = Object.entries(svc).sort((a, b) => b[1].revenue - a[1].revenue)[0] ?? null;

    const coach: { icon: LucideIcon; tone: Accent; category: string; badge: CoachBadge; text: ReactNode }[] = [];
    if (m.revenueGrowth !== 0 && lastRev > 0) {
      const up = m.revenueGrowth >= 0;
      coach.push({ icon: up ? Flame : TrendingDown, tone: up ? "success" : "warning",
        category: "Revenue", badge: up ? "success" : "warning",
        text: <>Revenue is <b className={up ? "text-success" : "text-warning"}>{up ? "up" : "down"} {Math.abs(Math.round(m.revenueGrowth))}%</b> versus last month{up ? " — keep the pace." : ". A follow-up push could recover it."}</> });
    }
    if (m.lapsedCount > 0) {
      coach.push({ icon: Repeat, tone: "warning", category: "Customers", badge: "warning",
        text: <><b className="text-ink">{m.lapsedCount}</b> {m.lapsedCount === 1 ? "customer hasn't" : "customers haven't"} been in for 60+ days — a quick text often wins them back.</> });
    }
    if (topSvc) {
      coach.push({ icon: Trophy, tone: "violet", category: "Services", badge: "opportunity",
        text: <>Upsell more <b className="text-ink">{topSvc[0]}</b> — it's your highest earner at {money(topSvc[1].revenue)}.</> });
    }
    if (busiestDay) {
      coach.push({ icon: CalendarClock, tone: "brand", category: "Scheduling", badge: "recommendation",
        text: <><b className="text-ink">{busiestDay}</b> is your busiest day — protect that slot and upsell add-ons.</> });
    }
    if (m.unconfirmedToday > 0) {
      coach.push({ icon: BellRing, tone: "warning", category: "Scheduling", badge: "warning",
        text: <>Confirm the <b className="text-ink">{m.unconfirmedToday}</b> unconfirmed {m.unconfirmedToday === 1 ? "job" : "jobs"} on today's board to avoid no-shows.</> });
    }

    // customer spotlight — the highest-spending repeat customer
    const spendByCust: Record<string, number> = {};
    for (const inv of invoices) spendByCust[inv.customer_id] = (spendByCust[inv.customer_id] ?? 0) + collected(inv);
    const apptsByCust: Record<string, typeof appointments> = {};
    for (const a of appointments) (apptsByCust[a.customer_id] ??= []).push(a);
    let spotlight: null | {
      id: string; name: string; spend: number; lastVisit: string | null; favService: string | null;
      visits: number; avgTicket: number; vehicle: string | null; dueInDays: number | null;
      likelihood: "High" | "Medium" | "Low"; upsell: string | null;
    } = null;
    const ranked = customers
      .map((c) => ({ c, spend: spendByCust[c.id] ?? 0, appts: apptsByCust[c.id] ?? [] }))
      .filter((r) => (r.appts.filter((a) => a.status === "completed").length) >= 2)
      .sort((a, b) => b.spend - a.spend);
    if (ranked[0]) {
      const { c, spend, appts } = ranked[0];
      const done = appts.filter((a) => a.status === "completed").sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
      const svcCount: Record<string, number> = {};
      for (const a of done) svcCount[a.service?.name ?? "Service"] = (svcCount[a.service?.name ?? "Service"] ?? 0) + 1;
      const fav = Object.entries(svcCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const visits = done.length;
      const vh = done.find((a) => a.vehicle)?.vehicle ?? null;
      // Rebooking cadence — average gap between their completed visits.
      const times = done.map((a) => new Date(a.scheduled_at).getTime()).sort((p, q) => p - q);
      let cadence: number | null = null;
      if (times.length >= 2) {
        let sum = 0; for (let i = 1; i < times.length; i++) sum += times[i] - times[i - 1];
        cadence = Math.round(sum / (times.length - 1) / 86_400_000);
      }
      const daysSince = times.length ? Math.floor((Date.now() - times[times.length - 1]) / 86_400_000) : 0;
      const dueInDays = cadence != null ? cadence - daysSince : null;
      const likelihood: "High" | "Medium" | "Low" = cadence != null
        ? (daysSince <= cadence ? "High" : daysSince <= cadence * 1.5 ? "Medium" : "Low")
        : (daysSince <= 45 ? "High" : daysSince <= 90 ? "Medium" : "Low");
      const booked = new Set(done.map((a) => a.service?.name).filter(Boolean));
      const upsell = services
        .filter((sv) => sv.active !== false && !booked.has(sv.name))
        .sort((a, b) => b.price - a.price)[0]?.name ?? null;
      spotlight = {
        id: c.id, name: c.name, spend, lastVisit: done[0]?.scheduled_at ?? null, favService: fav,
        visits, avgTicket: visits ? spend / visits : 0, vehicle: vh ? vehicleLabel(vh) : null,
        dueInDays, likelihood, upsell,
      };
    }

    // recent activity — merged, newest first
    type Act = { at: string; icon: LucideIcon; tone: Accent; text: ReactNode };
    const acts: Act[] = [];
    for (const a of appointments) {
      if (a.status === "completed") acts.push({ at: a.scheduled_at, icon: CheckCircle2, tone: "success", text: <><b className="text-ink">{a.service?.name ?? "Detail"}</b> completed for {a.customer?.name ?? "a customer"}</> });
    }
    for (const inv of invoices) {
      if (inv.status === "paid") acts.push({ at: inv.issued_at || inv.created_at, icon: ReceiptText, tone: "success", text: <>Invoice <b className="text-ink">{inv.number ?? ""}</b> paid · {money(inv.total)}</> });
    }
    for (const c of customers) acts.push({ at: c.created_at, icon: UserPlus, tone: "brand", text: <><b className="text-ink">{c.name}</b> added as a customer</> });
    const activity = acts.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

    return { goals, insight, coach: coach.slice(0, 4), spotlight, activity };
  }, [appointments, invoices, customers, services, m]);

  if (!org) return <SignInPrompt what="dashboard" />;
  if (cL && aL && iL && !customers.length && !appointments.length && !invoices.length) {
    return (
      <div className="animate-fade-up flex flex-col gap-6">
        <SkeletonHero />
        <SkeletonKpiCards count={4} />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <SkeletonChartPanel />
          <SkeletonDonutPanel />
        </div>
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
    <div className="animate-fade-up relative">
      {/* Ambient light — the hero's blue bleeds down into the page so the sections
          below read as one continuous surface instead of a dark card on white. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-[620px] overflow-hidden">
        <div className="absolute left-1/2 top-24 h-[460px] w-[min(1100px,125%)] -translate-x-1/2 rounded-full bg-brand-500/[0.07] blur-[120px]" />
        <div className="absolute right-[6%] top-56 h-64 w-64 rounded-full bg-violet/[0.06] blur-[100px]" />
      </div>

      {/* Premium command-center hero */}
      <div className="relative min-h-[248px] overflow-hidden rounded-[24px] shadow-hero-dark sm:min-h-[288px]">
        <DetailImage
          src={unsplash(PHOTO.glossyBlack, { w: 1600, q: 60 })}
          alt="Freshly detailed car with a deep gloss finish"
          className="absolute inset-0"
          eager
        />
        {/* richer, layered overlay — reads on the photo, dissolves into the app */}
        <div className="absolute inset-0 bg-gradient-to-r from-carbon-950 via-carbon-950/88 to-carbon-950/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon-950/70 to-transparent to-55%" />
        <div className="absolute inset-0 bg-paint-gloss opacity-70" />
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-brand-500/20 blur-[90px]" />
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

          {/* motivational, data-driven insight */}
          {showRevenue && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-3 py-1.5 text-[12.5px] font-medium text-white/85 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-brand-300" />
              {x.insight}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <HeroStat icon={CalendarClock} label="Today's jobs" value={m.todays.length} />
            {showRevenue && <HeroStat icon={DollarSign} label="Today's revenue" value={m.todayRevenue} money />}
            <HeroStat icon={CheckCircle2} label="Completed today" value={m.completedToday} />
          </div>

          {/* monthly goal progress — glass mini-bars */}
          {showRevenue && (
            <div className="mt-4 grid max-w-2xl gap-2.5 sm:grid-cols-3">
              {x.goals.map((g) => (
                <HeroGoal key={g.key} label={g.label} cur={g.cur} goal={g.goal} money={g.money} />
              ))}
            </div>
          )}

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

      {/* First-run setup guide — owners/admins only; hides once dismissed. */}
      {role !== "employee" && (
        <OnboardingChecklist
          hasBusiness={Boolean(org)}
          customers={customers.length}
          services={services.length}
          appointments={appointments.length}
          invoices={invoices.length}
        />
      )}

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

      {/* Premium insights — coach + goals, then spotlight + activity */}
      {showInsights && (
        <>
          <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
            <BusinessCoach items={x.coach} />
            <GoalsWidget goals={x.goals} />
          </div>
          <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
            {x.spotlight && <SpotlightWidget s={x.spotlight} />}
            <ActivityWidget items={x.activity} className={x.spotlight ? "" : "lg:col-span-2"} />
          </div>
        </>
      )}

      {/* Performance shortcut */}
      <section className="mt-6">
        <h2 className="mb-3.5 font-display text-[18px] font-bold tracking-tight text-ink">Grow your business</h2>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <GrowthCard icon={Gauge} title="Performance" stat={`${m.completionRate}%`} sub="Job completion rate" to="/analytics" />
          <GrowthCard icon={Star} title="Reviews" stat="Collect" sub="Google reviews after each detail" to="/reviews" />
          <GrowthCard icon={Sparkles} title="Leads" stat="Capture" sub="Turn inquiries into booked jobs" to="/leads" />
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
  icon: Icon,
  className,
  bodyClassName,
  index = 0,
  children,
}: {
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
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
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          {Icon && (
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Icon className="h-4 w-4" />
            </span>
          )}
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

// --------------------------------------------------------------------------- premium widgets

const GOAL_HEX: Record<"green" | "blue" | "purple", string> = { green: "#17A867", blue: "#2E7BFF", purple: "#7A5BE0" };
const kMoney = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
const initials = (s: string) => { const p = s.trim().split(/\s+/).filter(Boolean); return (p.length <= 1 ? (p[0] ?? "?").slice(0, 2) : p[0][0] + p[p.length - 1][0]); };
const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Glassy monthly-goal bar for the hero (renders on the dark photo). */
function HeroGoal({ label, cur, goal, money: isMoney }: { label: string; cur: number; goal: number; money: boolean }) {
  const pct = goal > 0 ? Math.min(100, Math.round((cur / goal) * 100)) : 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 backdrop-blur-md">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.06em] text-white/55">
        <span className="truncate">{label}</span>
        <span className="flex-none text-white/80">{pct}%</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1 text-white">
        <span className="font-display text-[15px] font-bold tnum">{isMoney ? kMoney(cur) : Math.round(cur)}</span>
        <span className="text-[11px] text-white/45">/ {isMoney ? kMoney(goal) : goal}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-300 to-brand-500"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </div>
    </div>
  );
}

type GoalItem = {
  key: string; label: string; icon: LucideIcon; cur: number; goal: number; money: boolean;
  tone: "green" | "blue" | "purple"; remaining: number; projected: number; done: boolean; onTrack: boolean; earlyDays: number;
};

/** Monthly goals — ring for at-a-glance, plus a progress bar and a forecast line
 *  (remaining + projected pace / ETA) so each goal tells you where it's headed. */
function GoalsWidget({ goals }: { goals: GoalItem[] }) {
  return (
    <Widget index={0} title="Monthly goals" subtitle="Pace toward a stretch on last month" icon={Target}>
      <div className="flex flex-col divide-y divide-line2">
        {goals.map((g) => {
          const pct = g.goal > 0 ? Math.min(100, Math.round((g.cur / g.goal) * 100)) : 0;
          const fmt = (n: number) => (g.money ? kMoney(n) : String(Math.round(n)));
          const cast = g.done
            ? { icon: CheckCircle2, text: "Goal reached — great month 🎉", cls: "text-success" }
            : g.onTrack
              ? { icon: TrendingUp, text: g.earlyDays >= 1 ? `On track — finishing ~${g.earlyDays}d early` : "On pace to hit goal", cls: "text-success" }
              : { icon: Clock, text: `${fmt(g.remaining)} to go · trending ${fmt(g.projected)}`, cls: "text-ink3" };
          return (
            <div key={g.key} className="flex items-center gap-3.5 py-3 first:pt-1 last:pb-1">
              <GoalRing value={pct} hex={GOAL_HEX[g.tone]} size={50} stroke={6} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink"><g.icon className="h-3.5 w-3.5 text-ink3" />{g.label}</span>
                  <span className="flex-none text-[12px] font-bold tnum text-ink">{fmt(g.cur)}<span className="font-medium text-ink3"> / {fmt(g.goal)}</span></span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line2">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: GOAL_HEX[g.tone] }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                </div>
                <div className={cn("mt-1.5 flex items-center gap-1 text-[11px] font-medium", cast.cls)}>
                  <cast.icon className="h-3 w-3 flex-none" />{cast.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}

function GoalRing({ value, hex, size = 74, stroke = 8 }: { value: number; hex: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, offset = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line2))" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={hex} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-[15px] font-bold tnum text-ink">{value}%</span>
      </div>
    </div>
  );
}

/** Data-driven business coach — rule-based suggestions, not an LLM. Each tip is
 *  classified (category + badge) so it reads like advice from an assistant. */
function BusinessCoach({ items }: { items: { icon: LucideIcon; tone: Accent; category: string; badge: CoachBadge; text: ReactNode }[] }) {
  return (
    <Widget index={0} title="Business coach" subtitle="Recommendations from your shop data" icon={Lightbulb}>
      {items.length === 0 ? (
        <InlineEmpty
          icon={<Lightbulb />}
          title="Coaching is warming up"
          body="Once you've booked a few jobs and logged some invoices, tailored tips from your shop data land here."
          action={
            <Link to="/appointments" className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/15">
              <CalendarPlus className="h-4 w-4" />Book a job
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2 pt-0.5">
          {items.map((it, i) => {
            const b = BADGE[it.badge];
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.32, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                className="flex items-start gap-2.5 rounded-xl bg-panel2/50 px-3 py-2.5 ring-1 ring-inset ring-line/60 transition-colors hover:bg-panel2">
                <span className={cn("mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg ring-1 ring-inset", ACCENT_BUBBLE[it.tone])}>
                  <it.icon className="h-[15px] w-[15px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] ring-1 ring-inset", b.cls)}>{b.label}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink3">{it.category}</span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-ink2">{it.text}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

type Spotlight = {
  id: string; name: string; spend: number; lastVisit: string | null; favService: string | null;
  visits: number; avgTicket: number; vehicle: string | null; dueInDays: number | null;
  likelihood: "High" | "Medium" | "Low"; upsell: string | null;
};

const RETURN_PILL: Record<Spotlight["likelihood"], { label: string; cls: string }> = {
  High:   { label: "Likely to return", cls: "bg-success/12 text-success ring-success/25" },
  Medium: { label: "Due to rebook",    cls: "bg-warning/12 text-warning ring-warning/25" },
  Low:    { label: "At risk",          cls: "bg-danger/12 text-danger ring-danger/25" },
};

/** The shop's most valuable regular, with the insight to act on them right now. */
function SpotlightWidget({ s }: { s: Spotlight }) {
  const pill = RETURN_PILL[s.likelihood];
  const nextVisit = s.dueInDays == null ? "—"
    : s.dueInDays > 0 ? `~${s.dueInDays}d`
    : s.dueInDays === 0 ? "due now"
    : `${-s.dueInDays}d late`;
  return (
    <Widget index={0} title="Customer spotlight" subtitle="Your most valuable regular" icon={Crown}>
      <div className="flex items-center gap-3.5 pt-1">
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet text-[17px] font-bold uppercase text-white shadow-glow">{initials(s.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-display text-[16px] font-bold tracking-tight text-ink">{s.name}</span>
            <span className="inline-flex flex-none items-center gap-1 rounded-full bg-violet/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-violet"><Crown className="h-3 w-3" />VIP</span>
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink3">
            {s.vehicle ? <>{s.vehicle} · </> : null}{s.visits} visits · last seen {s.lastVisit ? ago(s.lastVisit) : "—"}
          </div>
        </div>
        <Link to={`/customers/${s.id}`} aria-label={`View ${s.name}`} className="flex-none rounded-lg bg-panel2 p-2 text-ink3 ring-1 ring-inset ring-line transition-colors hover:bg-line2 hover:text-ink"><ArrowUpRight className="h-4 w-4" /></Link>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em] ring-1 ring-inset", pill.cls)}>{pill.label}</span>
        {s.favService && <span className="truncate text-[11.5px] text-ink3">Loves <b className="font-semibold text-ink2">{s.favService}</b></span>}
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-line rounded-xl bg-panel2/40 py-3 ring-1 ring-inset ring-line/60">
        <SpotStat label="Lifetime" value={money(Math.round(s.spend))} />
        <SpotStat label="Avg ticket" value={money(Math.round(s.avgTicket))} />
        <SpotStat label="Next visit" value={nextVisit} />
      </div>

      {s.upsell && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-violet/[0.06] px-3 py-2 ring-1 ring-inset ring-violet/15">
          <Sparkles className="h-3.5 w-3.5 flex-none text-violet" />
          <span className="truncate text-[11.5px] text-ink2">Suggested upsell: <b className="font-semibold text-ink">{s.upsell}</b></span>
        </div>
      )}

      <Link to="/appointments" className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 py-2.5 text-[12.5px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 hover:-translate-y-0.5 hover:shadow-glow-lg hover:brightness-[1.05] active:scale-[0.98]">
        <CalendarPlus className="h-4 w-4" />Book their next {s.favService ?? "detail"}
      </Link>
    </Widget>
  );
}
function SpotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 text-center">
      <div className="truncate font-display text-[14px] font-bold tnum text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-ink3">{label}</div>
    </div>
  );
}

/** Live-feeling recent activity feed. */
function ActivityWidget({ items, className }: { items: { at: string; icon: LucideIcon; tone: Accent; text: ReactNode }[]; className?: string }) {
  return (
    <Widget index={0} title="Recent activity" subtitle="What's happened lately" icon={BellRing} className={className}>
      {items.length === 0 ? (
        <InlineEmpty
          icon={<BellRing />}
          title="Nothing's happened yet"
          body="As you book jobs, take payments and add customers, the latest activity streams in right here."
          action={
            <Link to="/appointments" className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/15">
              <CalendarPlus className="h-4 w-4" />Book your first job
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col pt-0.5">
          {items.map((it, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 + i * 0.05, ease: "easeOut" }}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-panel2/60">
              <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-lg ring-1 ring-inset", ACCENT_BUBBLE[it.tone])}>
                <it.icon className="h-3.5 w-3.5" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink2">{it.text}</p>
              <span className="flex-none text-[11px] text-ink3">{ago(it.at)}</span>
            </motion.div>
          ))}
        </div>
      )}
    </Widget>
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
  type Tone = "danger" | "warning" | "brand" | "violet";
  const items: {
    tone: Tone; priority: "High" | "Medium"; icon: LucideIcon;
    title: string; desc: string; to: string; cta: string; noun: string;
  }[] = [];

  if (showMoney && overdueCount > 0) {
    items.push({
      tone: "danger", priority: "High", icon: AlertCircle,
      title: `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`,
      desc: `${money(overdueAmount)} is past due — chase it before it ages further.`,
      to: "/invoices", cta: "Chase payment", noun: "invoices",
    });
  }
  if (unconfirmedToday > 0) {
    items.push({
      tone: "warning", priority: "High", icon: Clock,
      title: `${unconfirmedToday} job${unconfirmedToday === 1 ? "" : "s"} unconfirmed`,
      desc: "Still unconfirmed on today's board — a quick reminder prevents no-shows.",
      to: "/appointments", cta: "Confirm jobs", noun: "schedule",
    });
  }
  if (showMoney && unsentCount > 0) {
    items.push({
      tone: "brand", priority: "Medium", icon: Send,
      title: `${unsentCount} invoice${unsentCount === 1 ? "" : "s"} not sent`,
      desc: "Completed work that hasn't been billed to the customer yet.",
      to: "/invoices", cta: "Send invoices", noun: "invoices",
    });
  }
  if (lapsedCount > 0) {
    items.push({
      tone: "violet", priority: "Medium", icon: BellRing,
      title: `${lapsedCount} client${lapsedCount === 1 ? "" : "s"} gone quiet`,
      desc: "No visit in 60+ days. A friendly nudge often wins them back.",
      to: "/customers", cta: "Send reminder", noun: "customers",
    });
  }

  if (items.length === 0) return null;

  // Subtle, single-accent styling: semantic colour lives only in the small icon
  // chip and the priority dot — never in full-card borders or buttons (which read
  // as a template/admin panel). The action itself is carried by one brand-blue
  // CTA, emphasised for High-priority and quiet for Medium.
  const ICON: Record<Tone, string> = {
    danger:  "bg-danger/10 text-danger",
    warning: "bg-warning/10 text-warning",
    brand:   "bg-brand-500/10 text-brand-500",
    violet:  "bg-violet/10 text-violet",
  };
  const DOT: Record<"High" | "Medium", string> = {
    High:   "bg-danger",
    Medium: "bg-warning",
  };

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">Needs attention</h2>
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink/[0.06] px-1.5 text-[11px] font-semibold tabular-nums text-ink2">
            {items.length}
          </span>
        </div>
        <span className="hidden text-[11.5px] text-ink3 sm:inline">Sorted by priority</span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((it, i) => {
          const isHigh = it.priority === "High";
          return (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={it.to}
                aria-label={`${it.cta}: ${it.title}`}
                className="group surface flex items-center gap-3 rounded-xl p-2.5 pr-2.5 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:border-brand-500/30 hover:shadow-lift active:translate-y-0 sm:pr-3"
              >
                <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-xl", ICON[it.tone])}>
                  <it.icon className="h-[18px] w-[18px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold tracking-tight text-ink">{it.title}</span>
                    <span className="ml-auto flex flex-none items-center gap-1 pl-1 text-[10px] font-semibold uppercase tracking-wide text-ink3">
                      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[it.priority])} />
                      {it.priority}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] leading-relaxed text-ink3">{it.desc}</p>
                </div>

                <span
                  className={cn(
                    "ml-1 inline-flex h-8 flex-none items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-[background-color,color,border-color] duration-150",
                    isHigh
                      ? "bg-brand-500 text-white shadow-sm group-hover:bg-brand-600"
                      : "border border-line bg-panel2 text-ink2 group-hover:border-brand-500/40 group-hover:text-ink"
                  )}
                >
                  <span className="hidden sm:inline">{it.cta}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import {
  Plus, Search, Car, ChevronRight, Phone, Mail, Wrench, DollarSign,
  Clock, Crown, Sparkles, Users, CalendarCheck, CalendarPlus, Receipt,
  UserRound, SlidersHorizontal, TrendingUp, TrendingDown,
  LayoutGrid, List, Gauge, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { AddCustomerModal } from "@/components/customer/AddCustomerModal";
import { EmptyState, NoResults, SignInPrompt, money } from "@/components/ui/data";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";
import { useCustomers } from "@/hooks/useCustomers";
import { useAppointments } from "@/hooks/useAppointments";
import { useInvoices } from "@/hooks/useInvoices";
import { useAuth } from "@/lib/auth";
import type { Customer } from "@/lib/models";
import { cn } from "@/lib/cn";

const DAY = 86_400_000;
const ACTIVE_STATUSES = new Set(["scheduled", "confirmed", "in_progress"]);

/** A customer enriched with figures derived from existing appointments/invoices.
 *  Nothing here is stored or invented — it mirrors the same math CustomerDetail uses. */
type Enriched = {
  c: Customer;
  jobs: number;          // total booked jobs
  details: number;       // completed jobs
  vehicles: number;      // distinct vehicles seen across their jobs
  spent: number;         // collected to date (paid + deposits)
  avgSpend: number;
  lastVisit: string | null;
  lastService: string | null;
  favoriteService: string | null;
  nextAppt: { at: string; service: string | null } | null;
  upcoming: number;
  isVip: boolean;
  isNew: boolean;
  isActive: boolean;
  needsFollowup: boolean;
  isInactive: boolean;
  lastActivity: number;  // sort key (ms)
  health: number;        // 0–100 relationship health, derived
  estNextDays: number | null; // predicted days to next visit, from cadence
};

type HealthTier = { label: string; tone: Tone; hex: string };
function healthTier(h: number): HealthTier {
  if (h >= 80) return { label: "Excellent", tone: "success", hex: "#17A867" };
  if (h >= 60) return { label: "Healthy", tone: "brand", hex: "#2E7BFF" };
  if (h >= 40) return { label: "At risk", tone: "amber", hex: "#E08A00" };
  return { label: "Needs follow-up", tone: "amber", hex: "#E5484D" };
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);

function whenLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = daysSince(iso);
  if (d <= 0) return "Today";
  if (d === 1) return "1d ago";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });

function moneyShort(n: number): string {
  if (!n) return "$0";
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

const SEGMENTS = [
  { key: "all", label: "All customers", match: (_: Enriched) => true },
  { key: "vip", label: "VIP", match: (e: Enriched) => e.isVip },
  { key: "active", label: "Active", match: (e: Enriched) => e.isActive },
  { key: "upcoming", label: "Upcoming appt", match: (e: Enriched) => e.upcoming > 0 },
  { key: "highvalue", label: "High value", match: (e: Enriched) => e.spent >= 500 },
  { key: "followup", label: "Needs follow-up", match: (e: Enriched) => e.needsFollowup },
  { key: "inactive", label: "Inactive", match: (e: Enriched) => e.isInactive },
  { key: "new", label: "New", match: (e: Enriched) => e.isNew },
] as const;
type SegKey = (typeof SEGMENTS)[number]["key"];

const SORTS = [
  { key: "recent", label: "Last activity" },
  { key: "name", label: "Name (A–Z)" },
  { key: "revenue", label: "Most revenue" },
  { key: "appointments", label: "Most appointments" },
  { key: "added", label: "Recently added" },
  { key: "visit", label: "Last visit" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

export default function Customers() {
  const { customers, loading, ready, create } = useCustomers();
  const { appointments } = useAppointments();
  const { invoices } = useInvoices();
  const { role } = useAuth();
  const navigate = useNavigate();
  // Detailers are read-only on customers (RLS: create/delete are owner/admin).
  const canManage = role !== "employee";

  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<SegKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<"card" | "list">("card");
  const [formOpen, setFormOpen] = useState(false);

  // Fold every customer's appointments + invoices into per-client figures once.
  const enriched = useMemo<Enriched[]>(() => {
    const apptsByCustomer = new Map<string, typeof appointments>();
    for (const a of appointments) {
      const list = apptsByCustomer.get(a.customer_id) ?? [];
      list.push(a);
      apptsByCustomer.set(a.customer_id, list);
    }
    const spentByCustomer = new Map<string, number>();
    for (const i of invoices) {
      const add = i.status === "paid" ? i.total : i.status === "deposit_paid" ? i.deposit_amount : 0;
      if (add) spentByCustomer.set(i.customer_id, (spentByCustomer.get(i.customer_id) ?? 0) + add);
    }

    const now = Date.now();
    return customers.map((c) => {
      const appts = apptsByCustomer.get(c.id) ?? [];
      const completed = appts.filter((a) => a.status === "completed");
      const future = appts
        .filter((a) => ACTIVE_STATUSES.has(a.status) && new Date(a.scheduled_at).getTime() >= now)
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
      const lastDone = completed.reduce<typeof completed[number] | null>(
        (m, a) => (!m || a.scheduled_at > m.scheduled_at ? a : m),
        null
      );
      const vehicles = new Set(appts.map((a) => a.vehicle_id).filter(Boolean)).size;
      const spent = spentByCustomer.get(c.id) ?? 0;

      // Most-booked service across their history.
      const svcCount = new Map<string, number>();
      for (const a of appts) {
        const n = a.service?.name;
        if (n) svcCount.set(n, (svcCount.get(n) ?? 0) + 1);
      }
      let favoriteService: string | null = null;
      let best = 0;
      for (const [n, count] of svcCount) if (count > best) { best = count; favoriteService = n; }

      const lastVisit = lastDone?.scheduled_at ?? null;
      const quiet = lastVisit ? daysSince(lastVisit) : null;
      const isVip = spent >= 1000 || completed.length >= 5;
      const isNew = daysSince(c.created_at) <= 30 && completed.length === 0;
      const isActive = future.length > 0;
      const needsFollowup =
        completed.length > 0 && !isActive && quiet !== null && quiet >= 60 && quiet < 180;
      const isInactive = completed.length > 0 && !isActive && quiet !== null && quiet >= 180;

      const lastActivity = Math.max(
        new Date(c.created_at).getTime(),
        ...appts.map((a) => new Date(a.scheduled_at).getTime())
      );

      // Relationship health — a recency/activity/loyalty blend. All derived.
      let health: number;
      if (isNew) health = 62;
      else if (isActive) health = 90;
      else if (quiet === null) health = 58;
      else if (quiet < 45) health = 84;
      else if (quiet < 90) health = 66;
      else if (quiet < 180) health = 44;
      else health = 26;
      health = clamp(health + (isVip ? 6 : 0) + (completed.length >= 5 ? 4 : 0), 5, 99);

      // Predicted next visit from the average gap between completed visits.
      let estNextDays: number | null = null;
      if (!isActive && completed.length >= 2 && lastVisit) {
        const ds = completed.map((a) => new Date(a.scheduled_at).getTime()).sort((x, y) => x - y);
        let tot = 0;
        for (let k = 1; k < ds.length; k++) tot += ds[k] - ds[k - 1];
        const avgGap = tot / (ds.length - 1) / DAY;
        estNextDays = Math.round(avgGap - daysSince(lastVisit));
      }

      return {
        c,
        jobs: appts.length,
        details: completed.length,
        vehicles,
        spent,
        avgSpend: completed.length ? spent / completed.length : 0,
        lastVisit,
        lastService: lastDone?.service?.name ?? null,
        favoriteService: best > 1 ? favoriteService : null,
        nextAppt: future[0] ? { at: future[0].scheduled_at, service: future[0].service?.name ?? null } : null,
        upcoming: future.length,
        isVip, isNew, isActive, needsFollowup, isInactive, lastActivity, health, estNextDays,
      };
    });
  }, [customers, appointments, invoices]);

  const totals = useMemo(
    () => ({
      clients: enriched.length,
      vips: enriched.filter((e) => e.isVip).length,
      followups: enriched.filter((e) => e.needsFollowup).length,
      revenue: enriched.reduce((s, e) => s + e.spent, 0),
    }),
    [enriched]
  );

  /** 6-month series + month-over-month deltas for the hero and KPI sparklines. */
  const trends = useMemo(() => {
    const now = new Date();
    const collected = (i: (typeof invoices)[number]) =>
      i.status === "paid" ? i.total : i.status === "deposit_paid" ? i.deposit_amount : 0;
    const custSeries: { value: number }[] = [];
    const revSeries: { value: number }[] = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const n = new Date(now.getFullYear(), now.getMonth() - k + 1, 1);
      custSeries.push({ value: customers.filter((c) => new Date(c.created_at) >= d && new Date(c.created_at) < n).length });
      revSeries.push({ value: invoices.reduce((s, i) => { const t = new Date(i.issued_at || i.created_at); return t >= d && t < n ? s + collected(i) : s; }, 0) });
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const activeThisMonth = new Set(
      appointments.filter((a) => new Date(a.scheduled_at).getTime() >= monthStart).map((a) => a.customer_id)
    ).size;
    const delta = (s: { value: number }[]) => {
      const cur = s[5]?.value ?? 0, prev = s[4]?.value ?? 0;
      return prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
    };
    return {
      custSeries, revSeries,
      newThisMonth: custSeries[5].value, newLastMonth: custSeries[4].value,
      revThisMonth: revSeries[5].value, revLastMonth: revSeries[4].value,
      custDelta: delta(custSeries), revDelta: delta(revSeries),
      activeThisMonth,
    };
  }, [customers, invoices, appointments]);

  // Only surface segment chips that actually have members (keeps it relevant, not noisy).
  const segCounts = useMemo(() => {
    const m = {} as Record<SegKey, number>;
    for (const s of SEGMENTS) m[s.key] = enriched.filter(s.match).length;
    return m;
  }, [enriched]);

  // Search stays type-instant: the input drives `query`, but the heavy
  // filter/sort runs off a deferred copy so React can interrupt it.
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const seg = SEGMENTS.find((s) => s.key === segment)!;
    const q = deferredQuery.trim().toLowerCase();
    const list = enriched
      .filter(seg.match)
      .filter((e) =>
        !q
          ? true
          : e.c.name.toLowerCase().includes(q) ||
            (e.c.email ?? "").toLowerCase().includes(q) ||
            (e.c.phone ?? "").toLowerCase().includes(q)
      );
    return list.slice().sort((a, b) => {
      switch (sort) {
        case "name": return a.c.name.localeCompare(b.c.name);
        case "revenue": return b.spent - a.spent;
        case "appointments": return b.jobs - a.jobs;
        case "added": return new Date(b.c.created_at).getTime() - new Date(a.c.created_at).getTime();
        case "visit": return (b.lastVisit ? new Date(b.lastVisit).getTime() : 0) - (a.lastVisit ? new Date(a.lastVisit).getTime() : 0);
        default: return b.lastActivity - a.lastActivity;
      }
    });
  }, [enriched, segment, deferredQuery, sort]);

  const openNew = () => setFormOpen(true);

  // Stable handlers so memoized rows/cards don't re-render on every keystroke.
  const openCustomer = useCallback((id: string) => navigate(`/customers/${id}`), [navigate]);
  const goSchedule = useCallback(() => navigate("/appointments"), [navigate]);
  const goInvoice = useCallback(() => navigate("/invoices"), [navigate]);

  return (
    <div className="animate-fade-up">
      {!ready ? (
        <>
          <PageHeader title="Customers" subtitle="Your clients, their vehicles, and their history" />
          <SignInPrompt what="customers" />
        </>
      ) : loading ? (
        <PageSkeleton variant="hero-cards" kpis={4} />
      ) : customers.length === 0 ? (
        <EmptyState
          art="car"
          title={canManage ? "No customers yet" : "No customers assigned to you"}
          body={
            canManage
              ? "Add your first customer to start tracking their vehicles, jobs, and spend."
              : "You'll see a customer here once you're assigned one of their jobs."
          }
          action={canManage ? <Button variant="primary" icon={<Plus />} onClick={openNew}>Add your first customer</Button> : undefined}
        />
      ) : (
        <>
          {/* ---- Hero ---------------------------------------------------- */}
          <section className="surface relative overflow-hidden rounded-[22px]">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/[0.10] via-transparent to-violet/[0.08]" />
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/12 blur-[90px]" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-paint-gloss opacity-30" />
            <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-[30px] font-extrabold leading-none tracking-tight text-ink sm:text-[36px]">Customers</h1>
                <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink3">
                  Every client you detail — their vehicles, spend and history, with the relationships that need attention surfaced automatically.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2.5">
                  <HeroFact label="Total clients" value={String(totals.clients)} />
                  <HeroFact label="Active this month" value={String(trends.activeThisMonth)} />
                  <HeroFact label="New this month" value={`+${trends.newThisMonth}`} tone="text-success" />
                  <HeroFact label="Lifetime revenue" value={money(Math.round(totals.revenue))} />
                </div>
              </div>
              {canManage && (
                <button onClick={openNew}
                  className="group inline-flex flex-none items-center justify-center gap-2 self-start rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 hover:brightness-[1.06] hover:shadow-glow-lg active:scale-[0.98] lg:self-center">
                  <Plus className="h-[18px] w-[18px] transition-transform duration-150 group-hover:rotate-90" />
                  Add customer
                </button>
              )}
            </div>
          </section>

          {/* ---- KPI cards with sparklines ------------------------------ */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi tone="success" icon={DollarSign} label="Lifetime revenue" value={money(Math.round(totals.revenue))}
              delta={trends.revDelta} deltaNote={`${money(Math.round(trends.revThisMonth))} this month`} series={trends.revSeries} />
            <Kpi tone="brand" icon={Users} label="New customers" value={String(trends.newThisMonth)}
              delta={trends.custDelta} deltaNote={`vs ${trends.newLastMonth} last month`} series={trends.custSeries} />
            <SummaryKpi icon={Crown} tone="violet" label="VIP clients" value={totals.vips} note="≥ $1k or 5+ details" />
            <SummaryKpi icon={Clock} tone="amber" label="Need follow-up" value={totals.followups} note="Quiet 60–180 days" />
          </div>

          {/* Search · sort · view · filters */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px] flex-1 sm:max-w-[340px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-ink3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, phone, or email…"
                className="input h-11 rounded-xl pl-9"
              />
            </div>
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink3" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="input h-11 w-auto cursor-pointer rounded-xl pl-9 pr-8 text-[13px] font-medium"
              >
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            {/* View toggle */}
            <div className="flex h-11 items-center rounded-xl bg-panel2 p-1">
              {([["card", LayoutGrid], ["list", List]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} aria-label={`${v} view`}
                  className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    view === v ? "bg-panel text-ink shadow-sm" : "text-ink3 hover:text-ink")}>
                  <Icon className="h-[17px] w-[17px]" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {SEGMENTS.filter((s) => s.key === "all" || segCounts[s.key] > 0).map((s) => {
              const on = segment === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSegment(s.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.97]",
                    on
                      ? "bg-brand-500 text-white shadow-glow"
                      : "text-ink3 ring-1 ring-inset ring-line hover:bg-line2 hover:text-ink"
                  )}
                >
                  {s.label}
                  <span className={cn("tnum text-[11px] font-bold", on ? "text-white/80" : "text-ink3")}>
                    {segCounts[s.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <NoResults
              title={query ? "No matching customers" : "This group is empty"}
              body={
                query
                  ? `No one matches “${query}”. Try a different name, or clear the search to see everyone.`
                  : "No customers fall into this segment right now. Switch groups or clear the filter to see your full list."
              }
              onClear={() => {
                setQuery("");
                setSegment("all");
              }}
              clearLabel={query ? "Clear search" : "Clear filter"}
            />
          ) : view === "list" ? (
            <div className="surface mt-5 overflow-hidden rounded-2xl">
              {filtered.map((e, i) => (
                <CustomerRow key={e.c.id} e={e} index={i} onOpen={openCustomer} />
              ))}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((e, i) => (
                <CustomerCard
                  key={e.c.id}
                  e={e}
                  index={i}
                  onOpen={openCustomer}
                  onSchedule={goSchedule}
                  onInvoice={goInvoice}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AddCustomerModal open={formOpen} onClose={() => setFormOpen(false)} create={create} />
    </div>
  );
}

// ---------------------------------------------------------------------------

type Tone = "brand" | "violet" | "amber" | "success" | "ink";
const TONE: Record<Tone, { text: string; bubble: string; chip: string }> = {
  brand:   { text: "text-brand-500", bubble: "bg-brand-500/12 text-brand-500", chip: "bg-brand-500/12 text-brand-500 ring-brand-500/25" },
  violet:  { text: "text-violet",    bubble: "bg-violet/12 text-violet",       chip: "bg-violet/12 text-violet ring-violet/25" },
  amber:   { text: "text-warning",   bubble: "bg-warning/12 text-warning",     chip: "bg-warning/12 text-warning ring-warning/25" },
  success: { text: "text-success",   bubble: "bg-success/12 text-success",     chip: "bg-success/12 text-success ring-success/25" },
  ink:     { text: "text-ink3",      bubble: "bg-line2 text-ink3",             chip: "bg-line2 text-ink3 ring-line" },
};

function HeroFact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3">{label}</div>
      <div className={cn("mt-0.5 font-display text-[19px] font-bold leading-none tracking-tight tnum text-ink", tone)}>{value}</div>
    </div>
  );
}

function DeltaChip({ value }: { value: number }) {
  const flat = Math.round(value) === 0;
  const up = value >= 0;
  return (
    <span className={cn("inline-flex flex-none items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tnum",
      flat ? "bg-line2 text-ink3" : up ? "bg-success/12 text-success" : "bg-danger/12 text-danger")}>
      {flat ? null : up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : "−"}{Math.abs(Math.round(value))}%
    </span>
  );
}

/** KPI card with a mini sparkline, month-over-month delta and comparison note. */
function Kpi({ tone, icon: Icon, label, value, delta, deltaNote, series }: {
  tone: Tone; icon: LucideIcon; label: string; value: string;
  delta: number; deltaNote: string; series: { value: number }[];
}) {
  const hex = tone === "success" ? "#17A867" : "#2E7BFF";
  return (
    <div className="surface group relative overflow-hidden rounded-2xl p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-paint-gloss opacity-25" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-xl", TONE[tone].bubble)}><Icon className="h-[18px] w-[18px]" /></span>
          <DeltaChip value={delta} />
        </div>
        <div className="mt-3 font-display text-[22px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
        <div className="mt-1 text-[11.5px] font-medium text-ink2">{label}</div>
        <div className="mt-0.5 text-[11px] text-ink3">{deltaNote}</div>
        <div className="-mx-1 mt-2 h-9">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`k${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={hex} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={hex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={hex} strokeWidth={2} fill={`url(#k${label.replace(/\s/g, "")})`} dot={false} animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** Simpler KPI (count + note) for metrics without a meaningful trend line. */
function SummaryKpi({ icon: Icon, tone, label, value, note }: {
  icon: LucideIcon; tone: Tone; label: string; value: number; note: string;
}) {
  return (
    <div className="surface group rounded-2xl p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-xl", TONE[tone].bubble)}><Icon className="h-[18px] w-[18px]" /></span>
      </div>
      <CountUp value={value} format={(n) => String(Math.round(n))} className="mt-3 block font-display text-[22px] font-bold leading-none tracking-tight tnum text-ink" />
      <div className="mt-1 text-[11.5px] font-medium text-ink2">{label}</div>
      <div className="mt-0.5 text-[11px] text-ink3">{note}</div>
    </div>
  );
}

/** Compact health ring used on cards and list rows. */
function HealthRing({ value, size = 42, stroke = 4.5 }: { value: number; size?: number; stroke?: number }) {
  const t = healthTier(value);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, offset = c * (1 - clamp(value, 0, 100) / 100);
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} title={`Health · ${t.label}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line2))" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.hex} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }} transition={{ duration: 0.8, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-[11px] font-bold tnum text-ink">{value}</span>
      </div>
    </div>
  );
}

/** Dense list-view row — same data, scannable one-per-line. */
const CustomerRow = memo(function CustomerRow({ e, index, onOpen }: { e: Enriched; index: number; onOpen: (id: string) => void }) {
  const { c } = e;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24, delay: Math.min(index, 12) * 0.02 }}
      role="button" tabIndex={0} onClick={() => onOpen(c.id)}
      onKeyDown={(ev) => { if (ev.key === "Enter") onOpen(c.id); }}
      className="cv-row group flex cursor-pointer items-center gap-3 border-b border-line2 px-4 py-3 outline-none transition-colors last:border-b-0 hover:bg-panel2/60 focus-visible:bg-panel2/60"
    >
      <Avatar name={c.name} vip={e.isVip} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[14.5px] font-bold tracking-tight text-ink">{c.name}</span>
          {e.isVip && <Pill tone="violet" icon={Crown}>VIP</Pill>}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-ink3">{c.phone || c.email || "No contact info"}</div>
      </div>
      <div className="hidden w-24 flex-none text-right sm:block">
        <div className="font-display text-[14px] font-bold tnum text-ink">{moneyShort(e.spent)}</div>
        <div className="text-[10.5px] text-ink3">lifetime</div>
      </div>
      <div className="hidden w-20 flex-none text-right md:block">
        <div className="font-display text-[14px] font-bold tnum text-ink">{e.details}</div>
        <div className="text-[10.5px] text-ink3">details</div>
      </div>
      <div className="hidden w-24 flex-none text-right md:block">
        <div className="text-[12.5px] font-semibold text-ink2">{whenLabel(e.lastVisit)}</div>
        <div className="text-[10.5px] text-ink3">last visit</div>
      </div>
      <HealthRing value={e.health} size={38} stroke={4} />
      <ChevronRight className="h-4 w-4 flex-none text-ink3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand-500" />
    </motion.div>
  );
});

/** Gradient initials avatar. Falls back from a photo if one ever exists. */
function Avatar({ name, vip, src }: { name: string; vip: boolean; src?: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  if (src) {
    return <img src={src} alt="" className="h-[52px] w-[52px] flex-none rounded-2xl object-cover ring-1 ring-inset ring-line" />;
  }
  return (
    <div
      className={cn(
        "relative flex h-[52px] w-[52px] flex-none items-center justify-center overflow-hidden rounded-2xl font-display text-[16px] font-bold tracking-tight text-white",
        vip
          ? "bg-gradient-to-br from-violet via-violet to-brand-600 shadow-[0_6px_18px_-6px_rgba(122,91,224,0.65)]"
          : "bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 shadow-[0_6px_18px_-6px_rgba(46,123,255,0.6)]"
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
      <span className="relative">{initials}</span>
    </div>
  );
}

function Pill({ tone, icon: Icon, children }: { tone: Tone; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex flex-none items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.04em] ring-1 ring-inset", TONE[tone].chip)}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-ink3">
        <Icon className="h-3.5 w-3.5 flex-none" />
        <span className="truncate text-[10px] font-medium uppercase tracking-[0.05em]">{label}</span>
      </div>
      <div className="mt-1 truncate font-display text-[15px] font-bold leading-none tnum text-ink">{value}</div>
    </div>
  );
}

/** Icon button with a tooltip that fades in on hover. */
function Action({ icon: Icon, label, href, onClick }: {
  icon: LucideIcon; label: string; href?: string; onClick?: () => void;
}) {
  const cls =
    "relative flex h-9 w-9 items-center justify-center rounded-xl text-ink3 ring-1 ring-inset ring-line transition-[color,background-color,transform,box-shadow] duration-150 hover:bg-brand-500/10 hover:text-brand-500 hover:ring-brand-500/30 active:scale-90";
  const tip = (
    <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-carbon-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/act:opacity-100">
      {label}
    </span>
  );
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <span className="group/act relative">
      {href ? (
        <a href={href} onClick={stop} aria-label={label} className={cls}>
          <Icon className="h-4 w-4" />
        </a>
      ) : (
        <button type="button" aria-label={label} className={cls}
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
          <Icon className="h-4 w-4" />
        </button>
      )}
      {tip}
    </span>
  );
}

const CustomerCard = memo(function CustomerCard({ e, index, onOpen, onSchedule, onInvoice }: {
  e: Enriched; index: number;
  onOpen: (id: string) => void; onSchedule: () => void; onInvoice: () => void;
}) {
  const { c } = e;
  const tier = healthTier(e.health);
  const identity = e.isVip
    ? { tone: "violet" as Tone, icon: Crown, text: "VIP" }
    : e.isNew
    ? { tone: "brand" as Tone, icon: Sparkles, text: "New" }
    : null;
  const state = e.isActive
    ? { tone: "success" as Tone, icon: CalendarCheck, text: e.upcoming > 1 ? `${e.upcoming} booked` : "Booked" }
    : e.needsFollowup
    ? { tone: "amber" as Tone, icon: Clock, text: "Follow-up" }
    : e.isInactive
    ? { tone: "ink" as Tone, icon: Clock, text: "Inactive" }
    : null;

  // A single contextual line — only when there's something worth saying.
  const context = e.nextAppt
    ? { icon: CalendarCheck, tone: "success" as Tone, text: `Next: ${shortDate(e.nextAppt.at)}${e.nextAppt.service ? ` · ${e.nextAppt.service}` : ""}` }
    : e.lastService
    ? { icon: Wrench, tone: "brand" as Tone, text: `Last: ${e.lastService}` }
    : e.favoriteService
    ? { icon: TrendingUp, tone: "brand" as Tone, text: `Usually books ${e.favoriteService}` }
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(c.id)}
      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(c.id); } }}
      className={cn(
        "cv-card surface group relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] p-5 text-left outline-none",
        "transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-brand-500/50",
        e.isVip && "ring-1 ring-inset ring-violet/25 hover:border-violet/40",
        e.isInactive && "opacity-[0.94]"
      )}
    >
      {/* VIP gets a premium top accent + glow; everyone else stays clean. */}
      {e.isVip && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet via-brand-500 to-transparent" />
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-violet/12 blur-2xl" />
        </>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-paint-gloss opacity-30" />

      {/* Identity */}
      <div className="relative flex items-start gap-3.5">
        <Avatar name={c.name} vip={e.isVip} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate font-display text-[17px] font-bold tracking-tight text-ink">{c.name}</h3>
            {identity && <Pill tone={identity.tone} icon={identity.icon}>{identity.text}</Pill>}
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5">
            {c.phone && (
              <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink2">
                <Phone className="h-3.5 w-3.5 flex-none text-ink3" /> {c.phone}
              </span>
            )}
            {c.email && (
              <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink3">
                <Mail className="h-3.5 w-3.5 flex-none" /> {c.email}
              </span>
            )}
            {!c.phone && !c.email && <span className="text-[12.5px] text-ink3">No contact info yet</span>}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-2">
          {state && <Pill tone={state.tone} icon={state.icon}>{state.text}</Pill>}
          <ChevronRight className="h-4 w-4 text-ink3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-500" />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-4 gap-3 rounded-2xl bg-ground/50 px-3.5 py-3 ring-1 ring-inset ring-line/60">
        <Stat icon={Car} value={String(e.vehicles)} label="Vehicles" />
        <Stat icon={Wrench} value={String(e.details)} label="Details" />
        <Stat icon={DollarSign} value={moneyShort(e.spent)} label="Spent" />
        <Stat icon={Clock} value={whenLabel(e.lastVisit)} label="Last visit" />
      </div>

      {/* Health + intelligent insights — fills the card with useful signal */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-panel2/40 px-3.5 py-2.5 ring-1 ring-inset ring-line/50">
        <HealthRing value={e.health} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
            <Gauge className={cn("h-3.5 w-3.5", TONE[tier.tone].text)} />Health · {tier.label}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink3">
            {e.avgSpend > 0 && <span>Avg ticket <b className="font-semibold text-ink2">{moneyShort(e.avgSpend)}</b></span>}
            {e.favoriteService && <span>Books <b className="font-semibold text-ink2">{e.favoriteService}</b></span>}
            {e.estNextDays != null && (
              <span>{e.estNextDays <= 0 ? <b className="font-semibold text-warning">Due to rebook</b> : <>~<b className="font-semibold text-ink2">{e.estNextDays}d</b> to rebook</>}</span>
            )}
          </div>
        </div>
      </div>

      {/* Context line */}
      {context && (
        <div className="mt-3 flex items-center gap-1.5 truncate text-[12px]">
          <context.icon className={cn("h-3.5 w-3.5 flex-none", TONE[context.tone].text)} />
          <span className="truncate text-ink2">{context.text}</span>
        </div>
      )}

      {/* Footer: quick actions + since */}
      <div className="mt-4 flex items-center gap-1.5 border-t border-line2 pt-3.5">
        {c.phone && <Action icon={Phone} label="Call" href={`tel:${c.phone}`} />}
        {c.email && <Action icon={Mail} label="Email" href={`mailto:${c.email}`} />}
        <Action icon={CalendarPlus} label="Schedule" onClick={onSchedule} />
        <Action icon={Receipt} label="Invoice" onClick={onInvoice} />
        <Action icon={UserRound} label="View profile" onClick={() => onOpen(c.id)} />
        <span className="ml-auto whitespace-nowrap text-[11px] text-ink3">
          Since {monthYear(c.created_at)}
        </span>
      </div>
    </motion.div>
  );
});

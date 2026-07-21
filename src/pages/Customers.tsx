import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, Search, Car, ChevronRight, Phone, Mail, Wrench, DollarSign,
  Clock, Crown, Sparkles, Users, CalendarCheck, CalendarPlus, Receipt,
  UserRound, SlidersHorizontal, TrendingUp, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { Loading, EmptyState, SignInPrompt, money } from "@/components/ui/data";
import { CountUp } from "@/components/ui/CountUp";
import { useCustomers, type CustomerInput } from "@/hooks/useCustomers";
import { useAppointments } from "@/hooks/useAppointments";
import { useInvoices } from "@/hooks/useInvoices";
import { useAuth } from "@/lib/auth";
import type { Customer } from "@/lib/models";
import { cn } from "@/lib/cn";

const EMPTY: CustomerInput = { name: "", email: "", phone: "", address: "", notes: "" };

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
};

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
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        isVip, isNew, isActive, needsFollowup, isInactive, lastActivity,
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

  // Only surface segment chips that actually have members (keeps it relevant, not noisy).
  const segCounts = useMemo(() => {
    const m = {} as Record<SegKey, number>;
    for (const s of SEGMENTS) m[s.key] = enriched.filter(s.match).length;
    return m;
  }, [enriched]);

  const filtered = useMemo(() => {
    const seg = SEGMENTS.find((s) => s.key === segment)!;
    const q = query.trim().toLowerCase();
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
  }, [enriched, segment, query, sort]);

  const openNew = () => { setForm(EMPTY); setError(null); setFormOpen(true); };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await create(form);
      setFormOpen(false);
      navigate(`/customers/${c.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Customers"
        subtitle="Your clients, their vehicles, and their history"
        actions={ready && canManage ? <Button variant="primary" icon={<Plus />} onClick={openNew}>Add customer</Button> : undefined}
      />

      {!ready ? (
        <SignInPrompt what="customers" />
      ) : loading ? (
        <Loading />
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
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Summary icon={Users} tone="brand" label="Total clients" value={totals.clients} />
            <Summary icon={Crown} tone="violet" label="VIP clients" value={totals.vips} />
            <Summary icon={Clock} tone="amber" label="Need follow-up" value={totals.followups} />
            <Summary icon={DollarSign} tone="success" label="Lifetime revenue" value={totals.revenue} isMoney />
          </div>

          {/* Search · sort · filters */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
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
            <div className="mt-6 rounded-2xl border border-line px-4 py-14 text-center text-[13px] text-ink3">
              {query ? <>No matches for “{query}”.</> : "No customers in this group yet."}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((e, i) => (
                <CustomerCard
                  key={e.c.id}
                  e={e}
                  index={i}
                  onOpen={() => navigate(`/customers/${e.c.id}`)}
                  onSchedule={() => navigate("/appointments")}
                  onInvoice={() => navigate("/invoices")}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add customer"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || !form.name.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(214) 555-0134" />
            </Field>
            <Field label="Email">
              <input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
            </Field>
          </div>
          <Field label="Address">
            <input className="input" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, Plano TX" />
          </Field>
          <Field label="Notes">
            <textarea className="input" rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex items-center gap-1.5 text-[11.5px] text-ink3">
            <Car className="h-3.5 w-3.5" /> You can add their vehicles on the next screen.
          </div>
          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        </div>
      </Modal>
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

function Summary({ icon: Icon, tone, label, value, isMoney }: {
  icon: LucideIcon; tone: Tone; label: string; value: number; isMoney?: boolean;
}) {
  return (
    <div className="surface flex items-center gap-3 rounded-2xl p-4">
      <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-xl", TONE[tone].bubble)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink3">{label}</div>
        <CountUp
          value={value}
          format={isMoney ? (n) => money(n) : (n) => String(Math.round(n))}
          className="mt-0.5 block font-display text-[20px] font-bold leading-none tracking-tight tnum text-ink"
        />
      </div>
    </div>
  );
}

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

function CustomerCard({ e, index, onOpen, onSchedule, onInvoice }: {
  e: Enriched; index: number;
  onOpen: () => void; onSchedule: () => void; onInvoice: () => void;
}) {
  const { c } = e;
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
      onClick={onOpen}
      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(); } }}
      className={cn(
        "surface group relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] p-5 text-left outline-none",
        "transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-brand-500/50",
        e.isVip && "hover:border-violet/40",
        e.isInactive && "opacity-[0.94]"
      )}
    >
      {/* VIP gets a premium top accent; everyone else stays clean. */}
      {e.isVip && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet via-brand-500 to-transparent" />
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
        <Action icon={UserRound} label="View profile" onClick={onOpen} />
        <span className="ml-auto whitespace-nowrap text-[11px] text-ink3">
          Since {monthYear(c.created_at)}
        </span>
      </div>
    </motion.div>
  );
}

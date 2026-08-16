import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Phone, Mail, MapPin, Car, Trash2, Pencil, Plus,
  DollarSign, CalendarCheck, CalendarClock, Clock, X as XIcon, Wrench,
  MessageSquare, ReceiptText, Image as ImageIcon, UserPlus, XCircle,
  Crown, Award, Star, StickyNote, Gauge, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CountUp } from "@/components/ui/CountUp";
import { Modal, Field } from "@/components/ui/Modal";
import { IconBtn, SignInPrompt, money } from "@/components/ui/data";
import { confirm, toast } from "@/components/ui/feedback";
import { PageSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { EmptyArt, type EmptyArtVariant } from "@/components/ui/EmptyArt";
import { FeatureLocked } from "@/components/UpgradeGate";
import { useCustomers, type CustomerInput } from "@/hooks/useCustomers";
import { useVehicles, type VehicleInput } from "@/hooks/useVehicles";
import { useAppointments } from "@/hooks/useAppointments";
import { useInvoices } from "@/hooks/useInvoices";
import { useJobPhotos } from "@/hooks/useJobPhotos";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import {
  vehicleLabel, APPOINTMENT_STATUS_LABEL, type AppointmentStatus, type JobPhoto, type Appointment,
} from "@/lib/models";
import { cn } from "@/lib/cn";

const REFERRAL_SOURCES = ["Instagram", "Facebook", "Google", "Referral", "Website", "Walk-in", "Yelp", "Nextdoor", "Other"];

const statusStyle: Record<AppointmentStatus, string> = {
  scheduled: "text-brand-500 bg-brand-500/10",
  confirmed: "text-violet bg-violet/10",
  in_progress: "text-warning bg-warning/10",
  completed: "text-success bg-success/10",
  cancelled: "text-ink3 bg-line2",
  no_show: "text-danger bg-danger/10",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtMonYear = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
const moneyShort = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : money(n));
const relDay = (daysSince: number | null, last: string | null) =>
  last == null ? "—" : daysSince === 0 ? "Today" : daysSince === 1 ? "Yesterday" : fmtDate(last);

const collected = (i: { status: string; total: number; deposit_amount: number }) =>
  i.status === "paid" ? i.total : i.status === "deposit_paid" ? i.deposit_amount : 0;

type TabKey = "overview" | "appointments" | "vehicles" | "invoices" | "photos" | "notes";
const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "appointments", label: "Appointments" },
  { key: "vehicles", label: "Vehicles" },
  { key: "invoices", label: "Invoices" },
  { key: "photos", label: "Photos" },
  { key: "notes", label: "Notes" },
];

export default function CustomerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { customers, loading, ready, update, remove } = useCustomers();
  const { appointments } = useAppointments();
  const { invoices } = useInvoices();
  // Also loaded inside VehiclesCard; the hook is cheap and scoped per customer,
  // and the header/stats/tab-counts need the counts before that card renders.
  const { vehicles } = useVehicles(id || null);
  const { photos } = useJobPhotos(id || null);
  const { role } = useAuth();
  const ent = useEntitlements();

  const canManage = role !== "employee";
  const gatedHistory = !ent.hasFeature("customer_history");
  const customer = customers.find((c) => c.id === id) ?? null;

  const [tab, setTab] = useState<TabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<CustomerInput>({ name: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const history = useMemo(
    () =>
      appointments
        .filter((a) => a.customer_id === id)
        .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)),
    [appointments, id]
  );

  const myInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.customer_id === id)
        .sort((a, b) => (b.issued_at || b.created_at).localeCompare(a.issued_at || a.created_at)),
    [invoices, id]
  );

  /**
   * The at-a-glance profile: lifetime value, visit counts, last/next visit and an
   * earned loyalty tier — all derived from live jobs + invoices, so they stay
   * correct with zero upkeep. The four numbers here feed the header + stat row.
   */
  const p = useMemo(() => {
    const spent = myInvoices.reduce((s, i) => s + collected(i), 0);
    const done = history.filter((a) => a.status === "completed");
    const now = Date.now();
    const upcoming = history
      .filter((a) => new Date(a.scheduled_at).getTime() >= now && (a.status === "scheduled" || a.status === "confirmed"))
      .slice(-1)[0] ?? null;
    const last = done[0]?.scheduled_at ?? null;
    const daysSince = last ? Math.floor((now - new Date(last).getTime()) / 86_400_000) : null;
    const visits = done.length;
    const avgTicket = visits ? spent / visits : 0;

    const tier: { label: string; tone: Tone; icon: LucideIcon } =
      spent >= 1500 || visits >= 10
        ? { label: "VIP", tone: "purple", icon: Crown }
        : spent >= 600 || visits >= 5
          ? { label: "Gold", tone: "orange", icon: Award }
          : visits >= 2
            ? { label: "Silver", tone: "blue", icon: Star }
            : { label: "New", tone: "green", icon: UserPlus };

    // Most-booked service.
    const counts = new Map<string, number>();
    for (const a of history) { const n = a.service?.name; if (n) counts.set(n, (counts.get(n) ?? 0) + 1); }
    let favorite: string | null = null; let favN = 0;
    for (const [n, c] of counts) if (c > favN) { favN = c; favorite = n; }

    // Visit cadence — average days between completed visits.
    const t = done.map((a) => new Date(a.scheduled_at).getTime()).sort((x, y) => x - y);
    let cadence: number | null = null;
    if (t.length >= 2) { let s = 0; for (let i = 1; i < t.length; i++) s += (t[i] - t[i - 1]) / 86_400_000; cadence = Math.round(s / (t.length - 1)); }

    // Lightweight relationship health — recency measured against their own rhythm.
    const health: { label: string; tone: Tone; score: number | null } =
      visits === 0 ? { label: "New", tone: "blue", score: null }
        : (() => {
          const cad = cadence ?? 45; const ds = daysSince ?? 0;
          if (ds <= cad) return { label: "Excellent", tone: "green" as Tone, score: 94 };
          if (ds <= cad * 2) return { label: "Good", tone: "green" as Tone, score: 78 };
          if (ds <= cad * 3) return { label: "At risk", tone: "orange" as Tone, score: 46 };
          return { label: "Dormant", tone: "red" as Tone, score: 24 };
        })();

    return { spent, visits, appointments: history.length, last, daysSince, upcoming, avgTicket, tier, favorite, cadence, health };
  }, [myInvoices, history]);

  if (!ready) return <SignInPrompt what="customers" />;
  if (loading) return <PageSkeleton variant="detail" />;
  if (!customer) {
    return (
      <div className="animate-fade-up">
        <BackLink />
        <div className="mt-6 border-y border-line px-6 py-16 text-center">
          <div className="text-[15px] font-semibold">Customer not found</div>
          <div className="mt-1 text-[13px] text-ink3">
            It may have been removed, or you may not have access to it.
          </div>
        </div>
      </div>
    );
  }

  const openEdit = () => {
    setForm({
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
      referral_source: customer.referral_source ?? "",
    });
    setErr(null);
    setEditOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await update(customer.id, form);
      setEditOpen(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const counts: Partial<Record<TabKey, number>> = {
    appointments: history.length,
    vehicles: vehicles.length,
    invoices: myInvoices.length,
    photos: photos.length,
  };

  return (
    <div className="animate-fade-up">
      <BackLink />

      {/* ---- Header: identity + iOS-style quick actions ------------------ */}
      <motion.section
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="surface relative mt-3 overflow-hidden rounded-2xl"
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-paint-gloss opacity-20" />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet text-[19px] font-bold uppercase text-white shadow-glow sm:h-[60px] sm:w-[60px] sm:text-[21px]">
              {initials(customer.name)}
            </div>
            <div className="min-w-0 flex-1">
              {/* Name is the focal point; VIP pill sits attached, soft and small. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">{customer.name}</h1>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset", TONE[p.tier.tone].chip)}>
                  <p.tier.icon className="h-3 w-3" />{p.tier.label}
                </span>
              </div>
              {/* Contact — quieter: muted, smaller, generous spacing. */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink3">
                {customer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
                {customer.email && <span className="flex min-w-0 items-center gap-1.5"><Mail className="h-3.5 w-3.5 flex-none" /><span className="truncate">{customer.email}</span></span>}
                {customer.address && <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 flex-none" /><span className="truncate">{customer.address}</span></span>}
                {!customer.phone && !customer.email && !customer.address && <span>No contact details yet</span>}
              </div>
            </div>
            <div className="flex flex-none items-center gap-2">
              {p.upcoming && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-success ring-1 ring-inset ring-success/25">
                  <CalendarCheck className="h-3 w-3" /> Booked
                </span>
              )}
              {canManage && (
                <IconBtn label="Delete customer" danger
                  onClick={async () => {
                    if (!(await confirm({ title: `Delete ${customer.name}?`, body: "Their vehicles, jobs and photos are permanently removed too. This can't be undone.", confirmLabel: "Delete customer", tone: "danger" }))) return;
                    try { await remove(customer.id); toast.success(`${customer.name} deleted`); navigate("/customers"); }
                    catch (e) { toast.error((e as Error).message); }
                  }}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              )}
            </div>
          </div>

          {/* Bottom action bar — bare icon circles + relationship age */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-t border-line pt-4">
            <div className="flex items-center gap-2.5">
              <ActionCircle icon={Phone} label="Call" href={customer.phone ? `tel:${customer.phone}` : undefined} />
              <ActionCircle icon={MessageSquare} label="Text" href={customer.phone ? `sms:${customer.phone}` : undefined} />
              <ActionCircle icon={Mail} label="Email" href={customer.email ? `mailto:${customer.email}` : undefined} />
              {canManage && <ActionCircle icon={Plus} label="Book appointment" onClick={() => navigate("/appointments")} />}
              {canManage && <ActionCircle icon={ReceiptText} label="Create invoice" onClick={() => navigate("/invoices")} />}
              {canManage && <ActionCircle icon={Pencil} label="Edit" onClick={openEdit} />}
            </div>
            <span className="text-[12px] text-ink3">Since <span className="font-semibold text-ink2">{fmtMonYear(customer.created_at)}</span></span>
          </div>
        </div>
      </motion.section>

      {/* ---- Next appointment — the standout status ---------------------- */}
      <NextAppointmentCard upcoming={p.upcoming} canManage={canManage} onBook={() => navigate("/appointments")} />

      {/* ---- Lifetime stats — one clean, scannable row ------------------- */}
      <StatsRow vehicles={vehicles.length} details={p.visits} spent={p.spent} last={p.last} daysSince={p.daysSince} />

      {/* ---- Tabs -------------------------------------------------------- */}
      <div className="mt-6 border-b border-line">
        <div role="tablist" aria-label="Customer sections" className="scrollbar-slim flex gap-0.5 overflow-x-auto pb-px">
          {TAB_DEFS.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex min-h-[42px] flex-none items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-semibold transition-colors sm:px-3.5",
                  active ? "text-ink" : "text-ink3 hover:text-ink2"
                )}
              >
                {t.label}
                {count != null && count > 0 && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums", active ? "bg-brand-500/10 text-brand-500" : "bg-line2 text-ink3")}>{count}</span>
                )}
                {active && <motion.span layoutId="cust-tab" transition={{ type: "spring", stiffness: 420, damping: 36 }} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Tab content ------------------------------------------------- */}
      <div className="mt-5">
        {tab === "overview" && (
          <OverviewTab
            createdAt={customer.created_at}
            history={history}
            invoices={myInvoices}
            photos={photos}
            notes={customer.notes ?? ""}
            gated={gatedHistory}
            canManage={canManage}
            onEditNote={() => setTab("notes")}
            insights={{ health: p.health, avgTicket: p.avgTicket, favorite: p.favorite, cadence: p.cadence, visits: p.visits }}
          />
        )}
        {tab === "appointments" && (
          <AppointmentsTab history={history} gated={gatedHistory} canManage={canManage} onBook={() => navigate("/appointments")} />
        )}
        {tab === "vehicles" && <VehiclesCard customerId={customer.id} canManage={canManage} />}
        {tab === "invoices" && (
          <InvoicesTab invoices={myInvoices} canManage={canManage} onCreate={() => navigate("/invoices")} />
        )}
        {tab === "photos" && <PhotosCard customerId={customer.id} gated={gatedHistory} />}
        {tab === "notes" && (
          <NotesTab
            customerName={customer.name}
            initialNotes={customer.notes ?? ""}
            canManage={canManage}
            onSave={(notes) => update(customer.id, { notes })}
          />
        )}
      </div>

      {/* Edit */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit customer"
        footer={
          <>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || !form.name.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Address">
            <input className="input" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Referral source">
            <select className="input" value={form.referral_source ?? ""} onChange={(e) => setForm({ ...form, referral_source: e.target.value })}>
              <option value="">How did they find you?</option>
              {REFERRAL_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea className="input" rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {err && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{err}</div>}
        </div>
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------------- tones */

type Tone = "green" | "blue" | "purple" | "orange" | "red";
const TONE: Record<Tone, { bubble: string; chip: string }> = {
  green:  { bubble: "bg-success/12 text-success",     chip: "bg-success/12 text-success ring-success/25" },
  blue:   { bubble: "bg-brand-500/12 text-brand-500", chip: "bg-brand-500/12 text-brand-500 ring-brand-500/25" },
  purple: { bubble: "bg-violet/12 text-violet",       chip: "bg-violet/12 text-violet ring-violet/25" },
  orange: { bubble: "bg-warning/12 text-warning",     chip: "bg-warning/12 text-warning ring-warning/25" },
  red:    { bubble: "bg-danger/12 text-danger",       chip: "bg-danger/12 text-danger ring-danger/25" },
};
const TONE_TEXT: Record<Tone, string> = { green: "text-success", blue: "text-brand-500", purple: "text-violet", orange: "text-warning", red: "text-danger" };
const TONE_HEX: Record<Tone, string> = { green: "#17A867", blue: "#2E7BFF", purple: "#7A5BE0", orange: "#E08A00", red: "#E1483C" };

/* -------------------------------------------------------------- tabs */

type Insights = {
  health: { label: string; tone: Tone; score: number | null };
  avgTicket: number; favorite: string | null; cadence: number | null; visits: number;
};

function OverviewTab({ createdAt, history, invoices, photos, notes, gated, canManage, onEditNote, insights }: {
  createdAt: string;
  history: Appointment[];
  invoices: { id: string; number: string | null; status: string; total: number; issued_at: string; created_at: string }[];
  photos: JobPhoto[];
  notes: string;
  gated: boolean;
  canManage: boolean;
  onEditNote: () => void;
  insights: Insights;
}) {
  const completed = history.filter((a) => a.status === "completed");
  return (
    <div className="flex flex-col gap-4">
      <InsightsCard {...insights} />
      <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Recent activity" subtitle="Newest first">
        {gated ? (
          <FeatureLocked feature="customer_history" title="Activity history" description="See every past job, invoice and update on one timeline." compact />
        ) : (
          <ActivityTimeline createdAt={createdAt} appointments={history} invoices={invoices} photos={photos} limit={7} />
        )}
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title="Service history" subtitle={completed.length ? `${completed.length} completed` : undefined}>
          {gated ? (
            <FeatureLocked feature="customer_history" title="Service history" description="Every past job, what was done, and what it earned." compact />
          ) : completed.length === 0 ? (
            <Empty art="garage" title="No completed jobs yet" body="Once a booking is marked complete, it lands here with its price." />
          ) : (
            <div className="divide-y divide-line2">
              {completed.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Wrench className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{a.service?.name ?? "Service"}</div>
                    <div className="truncate text-xs text-ink3">{fmtDate(a.scheduled_at)}{a.vehicle ? ` · ${vehicleLabel(a.vehicle)}` : ""}</div>
                  </div>
                  <span className="whitespace-nowrap text-[13px] font-semibold tnum">{money(a.price ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Notes" subtitle="Private to your shop">
          {notes ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink2">{notes}</p>
          ) : (
            <p className="text-[13px] text-ink3">No notes yet — jot down gate codes, preferences or paint condition.</p>
          )}
          {canManage && (
            <button onClick={onEditNote} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-500 hover:text-brand-600">
              <StickyNote className="h-3.5 w-3.5" />{notes ? "Edit note" : "Add a note"}
            </button>
          )}
        </Panel>
      </div>
      </div>
    </div>
  );
}

function AppointmentRow({ a }: { a: Appointment }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Wrench className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{a.service?.name ?? "Service"}</div>
        <div className="truncate text-xs text-ink3">{fmtDateTime(a.scheduled_at)}{a.vehicle ? ` · ${vehicleLabel(a.vehicle)}` : ""}</div>
      </div>
      <span className="whitespace-nowrap text-[13px] font-semibold tnum">{money(a.price ?? 0)}</span>
      <span className={cn("hidden whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline", statusStyle[a.status])}>
        {APPOINTMENT_STATUS_LABEL[a.status]}
      </span>
    </div>
  );
}

function AppointmentsTab({ history, gated, canManage, onBook }: {
  history: Appointment[]; gated: boolean; canManage: boolean; onBook: () => void;
}) {
  const now = Date.now();
  const upcoming = history
    .filter((a) => new Date(a.scheduled_at).getTime() >= now && (a.status === "scheduled" || a.status === "confirmed"))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const upcomingIds = new Set(upcoming.map((a) => a.id));
  const past = history.filter((a) => !upcomingIds.has(a.id));

  return (
    <Panel
      title="Appointments"
      subtitle={history.length ? `${history.length} total` : undefined}
      action={canManage ? <TabActionButton icon={Plus} label="Book" onClick={onBook} /> : undefined}
    >
      {gated ? (
        <FeatureLocked feature="customer_history" title="Appointment history" description="Every past and upcoming visit for this customer, with status and price." compact />
      ) : history.length === 0 ? (
        <Empty
          art="garage" title="No appointments yet" body="Book this customer in and their schedule builds here."
          action={canManage ? <TabActionButton icon={Plus} label="Book appointment" onClick={onBook} solid /> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {upcoming.length > 0 && (
            <div>
              <GroupLabel>Upcoming</GroupLabel>
              <div className="divide-y divide-line2">{upcoming.map((a) => <AppointmentRow key={a.id} a={a} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <GroupLabel>Past</GroupLabel>
              <div className="divide-y divide-line2">{past.map((a) => <AppointmentRow key={a.id} a={a} />)}</div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function InvoicesTab({ invoices, canManage, onCreate }: {
  invoices: { id: string; number: string | null; status: string; total: number; issued_at: string; created_at: string }[];
  canManage: boolean; onCreate: () => void;
}) {
  return (
    <Panel
      title="Invoices"
      subtitle={invoices.length ? `${invoices.length} total` : undefined}
      action={canManage ? <TabActionButton icon={ReceiptText} label="Create" onClick={onCreate} /> : undefined}
    >
      {invoices.length === 0 ? (
        <Empty
          art="receipt" title="No invoices yet" body="Invoices you create for this customer show up here."
          action={canManage ? <TabActionButton icon={ReceiptText} label="Create invoice" onClick={onCreate} solid /> : undefined}
        />
      ) : (
        <div className="divide-y divide-line2">
          {invoices.map((i) => (
            <div key={i.id} className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><ReceiptText className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{i.number ? `#${i.number}` : "Invoice"}</div>
                <div className="truncate text-[11.5px] text-ink3">{fmtDate(i.issued_at || i.created_at)}</div>
              </div>
              <span className="whitespace-nowrap text-[13px] font-semibold tnum">{money(i.total)}</span>
              <InvoiceBadge status={i.status} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function NotesTab({ customerName, initialNotes, canManage, onSave }: {
  customerName: string; initialNotes: string; canManage: boolean; onSave: (notes: string) => Promise<unknown>;
}) {
  const [val, setVal] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const dirty = val !== initialNotes;
  const first = customerName.trim().split(/\s+/)[0] || customerName;

  const save = async () => {
    setBusy(true);
    try {
      await onSave(val);
      toast.success("Note saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Customer notes" subtitle="Private to your shop">
      <textarea
        className="input min-h-[180px] w-full leading-relaxed"
        rows={8}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        disabled={!canManage}
        placeholder={`Notes about ${first} — gate codes, parking, product preferences, paint condition, anything worth remembering.`}
      />
      {canManage && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {dirty && <button onClick={() => setVal(initialNotes)} className="text-[12.5px] font-semibold text-ink3 hover:text-ink">Discard</button>}
          <Button variant="primary" onClick={save} disabled={!dirty || busy}>{busy ? "Saving…" : "Save note"}</Button>
        </div>
      )}
    </Panel>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.07em] text-ink3">{children}</div>;
}

function TabActionButton({ icon: Icon, label, onClick, solid }: {
  icon: typeof Plus; label: string; onClick: () => void; solid?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors active:scale-[0.97]",
        solid ? "bg-brand-500 text-white shadow-glow hover:brightness-[1.06]" : "bg-brand-500/10 text-brand-500 hover:bg-brand-500/15"
      )}
    >
      <Icon className="h-4 w-4" />{label}
    </button>
  );
}

/* --------------------------------------------------------- small parts */

/** Two-letter monogram from the customer's name ("Marcus Webb" → "MW"). */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]);
}

function InvoiceBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-success/12 text-success",
    deposit_paid: "bg-violet/12 text-violet",
    sent: "bg-brand-500/12 text-brand-500",
    draft: "bg-line2 text-ink3",
    overdue: "bg-danger/12 text-danger",
  };
  const label = status === "deposit_paid" ? "Deposit" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={cn("hidden flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold sm:inline", map[status] ?? "bg-line2 text-ink3")}>{label}</span>;
}

/** A quick action. Renders as a link for tel:/sms:/mailto:, a button otherwise.
 *  Disabled (not hidden) when the customer has no phone/email, so the row's
 *  shape stays stable and it's obvious what's missing. */
/** A bare icon-circle action (iOS action-bar style). Link for tel:/sms:/mailto:,
 *  button otherwise; dimmed + inert when the contact detail is missing. */
function ActionCircle({ icon: Icon, label, href, onClick }: {
  icon: LucideIcon; label: string; href?: string; onClick?: () => void;
}) {
  const enabled = Boolean(href || onClick);
  const cls = cn(
    "flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset transition-[transform,background-color,color,box-shadow,border-color] duration-150 ease-out",
    enabled
      ? "bg-panel text-ink2 ring-line hover:-translate-y-0.5 hover:bg-panel2 hover:text-brand-500 hover:ring-brand-500/40 hover:shadow-card active:scale-95"
      : "cursor-not-allowed bg-panel/60 text-ink3/40 ring-line"
  );
  const icon = <Icon className="h-[18px] w-[18px]" />;
  if (href) return <a href={href} aria-label={label} title={label} className={cls}>{icon}</a>;
  if (onClick) return <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>{icon}</button>;
  return <span aria-disabled aria-label={label} title={`No ${label.toLowerCase()} on file`} className={cls}>{icon}</span>;
}

/** The #2 element in the hierarchy: a calm status card that turns green only
 *  when there's actually an upcoming visit. */
function NextAppointmentCard({ upcoming, canManage, onBook }: {
  upcoming: { scheduled_at: string; service?: { name: string } | null } | null; canManage: boolean; onBook: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface mt-4 flex items-center gap-4 rounded-2xl p-4 sm:p-5", upcoming && "ring-1 ring-inset ring-success/25")}
    >
      <span className={cn("flex h-11 w-11 flex-none items-center justify-center rounded-xl", upcoming ? "bg-success/12 text-success" : "bg-line2 text-ink3")}>
        <CalendarClock className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        {upcoming ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-inset ring-success/20">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Upcoming appointment
            </span>
            <div className="mt-1.5 truncate text-[15px] font-bold text-ink">
              {fmtDate(upcoming.scheduled_at)}{upcoming.service?.name ? ` · ${upcoming.service.name}` : ""}
            </div>
          </>
        ) : (
          <>
            <div className="text-[13.5px] font-semibold text-ink2">No upcoming appointment</div>
            <div className="mt-0.5 text-[12px] text-ink3">Book their next detail to keep the rhythm going.</div>
          </>
        )}
      </div>
      {!upcoming && canManage && (
        <button onClick={onBook} className="inline-flex h-9 flex-none items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/15 active:scale-[0.97]">
          <Plus className="h-4 w-4" /> Book
        </button>
      )}
    </motion.div>
  );
}

/** Lifetime stats in one card — small icon+label on top, big value below,
 *  hairline dividers. Numbers count up on open. */
function StatsRow({ vehicles, details, spent, last, daysSince }: {
  vehicles: number; details: number; spent: number; last: string | null; daysSince: number | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="surface mt-4 overflow-hidden rounded-2xl"
    >
      <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
        <StatCell icon={Car} label="Vehicles"><CountUp value={vehicles} /></StatCell>
        <StatCell icon={Wrench} label="Details"><CountUp value={details} /></StatCell>
        <StatCell icon={DollarSign} label="Spent"><CountUp value={spent} format={moneyShort} /></StatCell>
        <StatCell icon={Clock} label="Last visit">{relDay(daysSince, last)}</StatCell>
      </div>
    </motion.div>
  );
}

function StatCell({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="mt-2 truncate font-display text-[20px] font-bold leading-none tracking-tight tnum text-ink sm:text-[22px]">{children}</div>
    </div>
  );
}

/** A compact health ring — the score in a tone-coloured dial. */
function HealthRing({ score, tone }: { score: number | null; tone: Tone }) {
  const r = 22; const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, score ?? 0)) / 100);
  return (
    <div className="relative h-14 w-14 flex-none">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-line2" />
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
          stroke={TONE_HEX[tone]} strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[15px] font-bold tnum text-ink">{score ?? "–"}</div>
    </div>
  );
}

/** Supporting insights — a health dial with a one-line summary beside it. */
function InsightsCard({ health, avgTicket, favorite, cadence, visits }: Insights) {
  return (
    <div className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <HealthRing score={health.score} tone={health.tone} />
        <div className="min-w-0">
          <div className={cn("flex items-center gap-1.5 text-[14.5px] font-bold tracking-tight", TONE_TEXT[health.tone])}>
            <Gauge className="h-4 w-4" /> Health · {health.label}
          </div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-ink3">
            {visits ? <>Avg ticket <b className="font-semibold text-ink2">{money(avgTicket)}</b></> : "No visits yet"}
            {favorite && <> · Books <b className="font-semibold text-ink2">{favorite}</b></>}
            {cadence ? <> · every <b className="font-semibold text-ink2">{cadence}d</b></> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One chronological stream merged from jobs, invoices and photos. */
function ActivityTimeline({ createdAt, appointments, invoices, photos, limit }: {
  createdAt: string;
  appointments: { id: string; scheduled_at: string; status: AppointmentStatus; price: number | null; service?: { name: string } | null }[];
  invoices: { id: string; number: string | null; status: string; total: number; issued_at: string; created_at: string }[];
  photos: JobPhoto[];
  limit?: number;
}) {
  type Ev = { at: string; icon: typeof Wrench; tone: Tone; title: string; meta?: string };
  const events: Ev[] = [];

  events.push({ at: createdAt, icon: UserPlus, tone: "blue", title: "Customer added", meta: "Joined the book" });
  for (const a of appointments) {
    const done = a.status === "completed";
    events.push({
      at: a.scheduled_at,
      icon: done ? Wrench : a.status === "cancelled" || a.status === "no_show" ? XCircle : CalendarClock,
      tone: done ? "green" : a.status === "cancelled" || a.status === "no_show" ? "orange" : "blue",
      title: done ? `${a.service?.name ?? "Service"} completed` : `${a.service?.name ?? "Appointment"} — ${APPOINTMENT_STATUS_LABEL[a.status]}`,
      meta: a.price != null ? money(a.price) : undefined,
    });
  }
  for (const i of invoices) {
    events.push({
      at: i.issued_at || i.created_at,
      icon: ReceiptText,
      tone: i.status === "paid" ? "green" : "orange",
      title: i.status === "paid" ? `Invoice ${i.number ?? ""} paid` : `Invoice ${i.number ?? ""} issued`,
      meta: money(i.total),
    });
  }
  for (const ph of photos) {
    events.push({ at: ph.created_at, icon: ImageIcon, tone: "purple", title: "Photo uploaded", meta: ph.caption ?? undefined });
  }

  const sorted = events.sort((a, b) => b.at.localeCompare(a.at));
  const shown = limit ? sorted.slice(0, limit) : sorted;

  if (sorted.length <= 1) {
    return <Empty art="chart" title="Nothing has happened yet" body="Book this customer in and their whole history builds here automatically." />;
  }

  return (
    <ol className="relative ml-1 border-l border-line">
      {shown.map((e, i) => (
        <li key={i} className="relative flex items-start gap-3 py-3 pl-6">
          <span className={cn("absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-panel", TONE[e.tone].bubble)}>
            <e.icon className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-ink">{e.title}</div>
            <div className="mt-0.5 text-[11.5px] text-ink3">{fmtDateTime(e.at)}</div>
          </div>
          {e.meta && <span className="flex-none whitespace-nowrap text-[12.5px] font-semibold tnum text-ink2">{e.meta}</span>}
        </li>
      ))}
    </ol>
  );
}

function BackLink() {
  return (
    <Link to="/customers" className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-ink3 hover:text-brand-500">
      <ArrowLeft className="h-4 w-4" /> All customers
    </Link>
  );
}

/** A section card: heading (+ optional subtitle / right-aligned action), then content. */
function Panel({ title, subtitle, action, className, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={cn("surface rounded-[20px] p-5 sm:p-6", className)}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <span className="text-[12px] font-medium text-ink3">· {subtitle}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Empty({ art, title, body, action }: { art: EmptyArtVariant; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <EmptyArt variant={art} className="w-[130px]" />
      <div className="text-[13.5px] font-semibold">{title}</div>
      <div className="max-w-xs text-xs text-ink3">{body}</div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------

const EMPTY_VEHICLE: VehicleInput = { year: null, make: "", model: "", color: "", license_plate: "", vin: "", notes: "" };

function VehiclesCard({ customerId, canManage }: { customerId: string; canManage: boolean }) {
  const { vehicles, create, remove } = useVehicles(customerId);
  const ent = useEntitlements();
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState<VehicleInput>(EMPTY_VEHICLE);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await create({ ...v, year: v.year ? Number(v.year) : null });
      setV(EMPTY_VEHICLE);
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Vehicles"
      subtitle={vehicles.length ? `${vehicles.length}` : undefined}
      action={
        canManage && ent.hasFeature("vehicle_profiles") ? (
          <button className="text-[12.5px] font-semibold text-brand-500" onClick={() => setAdding((a) => !a)}>
            {adding ? "Cancel" : "+ Add vehicle"}
          </button>
        ) : undefined
      }
    >
      {!ent.hasFeature("vehicle_profiles") ? (
        <FeatureLocked
          feature="vehicle_profiles"
          title="Vehicle profiles"
          description="Track each customer's vehicles — make, model, colour, plate and VIN."
          compact
        />
      ) : vehicles.length === 0 && !adding ? (
        <Empty art="car" title="No vehicles yet" body="Add the cars you look after for this customer so every job links to the right vehicle."
          action={canManage ? (
            <button onClick={() => setAdding(true)} className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/15">
              <Plus className="h-4 w-4" />Add a vehicle
            </button>
          ) : undefined} />
      ) : (
        <div className="divide-y divide-line2">
          {vehicles.map((veh) => (
            <div key={veh.id} className="group flex items-start gap-3 py-3">
              <Link to={`/vehicles/${veh.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 transition-transform duration-200 group-hover:scale-105">
                  <Car className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink transition-colors group-hover:text-brand-500">{vehicleLabel(veh)}</div>
                  <div className="text-xs text-ink3">
                    {[veh.color, veh.license_plate, veh.vin ? `VIN ${veh.vin}` : null].filter(Boolean).join(" · ") || "No details"}
                  </div>
                  {veh.notes && <div className="mt-1 text-xs text-ink2">{veh.notes}</div>}
                </div>
              </Link>
              {canManage && (
                <IconBtn onClick={async () => { if (await confirm({ title: `Remove ${vehicleLabel(veh)}?`, body: "This removes the vehicle from this customer.", confirmLabel: "Remove vehicle", tone: "danger" })) { try { await remove(veh.id); toast.success("Vehicle removed"); } catch (e) { toast.error((e as Error).message); } } }} label="Remove vehicle" danger>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 grid grid-cols-2 gap-2">
            <input className="input" placeholder="Year" value={v.year ?? ""} onChange={(e) => setV({ ...v, year: e.target.value ? Number(e.target.value) : null })} />
            <input className="input" placeholder="Make" value={v.make ?? ""} onChange={(e) => setV({ ...v, make: e.target.value })} />
            <input className="input" placeholder="Model" value={v.model ?? ""} onChange={(e) => setV({ ...v, model: e.target.value })} />
            <input className="input" placeholder="Color" value={v.color ?? ""} onChange={(e) => setV({ ...v, color: e.target.value })} />
            <input className="input" placeholder="License plate" value={v.license_plate ?? ""} onChange={(e) => setV({ ...v, license_plate: e.target.value })} />
            <input className="input" placeholder="VIN" value={v.vin ?? ""} onChange={(e) => setV({ ...v, vin: e.target.value })} />
            <textarea className="input col-span-2" rows={2} placeholder="Vehicle notes" value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} />
            <Button variant="primary" className="col-span-2" onClick={add} disabled={busy}>
              {busy ? "Adding…" : "Add vehicle"}
            </Button>
          </div>
        )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function PhotosCard({ customerId, gated }: { customerId: string; gated: boolean }) {
  const { photos, loading, upload, remove } = useJobPhotos(gated ? null : customerId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<JobPhoto | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await upload(file);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Photos"
      subtitle={!gated && photos.length ? `${photos.length}` : undefined}
      action={
        !gated ? (
          <button className="text-[12.5px] font-semibold text-brand-500 disabled:opacity-50" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : "+ Add photo"}
          </button>
        ) : undefined
      }
    >
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        {gated ? (
          <FeatureLocked
            feature="customer_history"
            title="Job photos"
            description="Keep before-and-after shots against each customer's history."
            compact
          />
        ) : loading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <Empty art="photo" title="No photos yet" body="Add before-and-after shots from this customer's jobs." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-panel2">
                {p.url ? (
                  <img src={p.url} alt={p.caption ?? "Job photo"} className="h-full w-full cursor-pointer object-cover" onClick={() => setPreview(p)} loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-ink3">Unavailable</div>
                )}
                <button
                  onClick={async () => { if (await confirm({ title: "Delete this photo?", confirmLabel: "Delete photo", tone: "danger" })) { try { await remove(p); toast.success("Photo deleted"); } catch (e) { toast.error((e as Error).message); } } }}
                  aria-label="Delete photo"
                  className="absolute right-1 top-1 hidden h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white group-hover:flex hover:bg-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {err && <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{err}</div>}

      {preview &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setPreview(null)}>
            <img src={preview.url} alt={preview.caption ?? "Job photo"} className="max-h-full max-w-full rounded-lg object-contain" />
            <button className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Close">
              <XIcon className="h-5 w-5" />
            </button>
          </div>,
          document.body
        )}
    </Panel>
  );
}

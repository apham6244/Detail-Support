import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, MapPin, Car, Trash2, Pencil, Plus,
  DollarSign, Repeat, CalendarCheck, X as XIcon, Wrench,
  MessageSquare, ReceiptText, Sparkles, TrendingUp, CalendarClock,
  UserPlus, XCircle, Image as ImageIcon, Clock, Crown,
  Gauge, Heart, Award, Gift, AlertTriangle, ArrowUpRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
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
import { useServices } from "@/hooks/useServices";
import { useJobPhotos } from "@/hooks/useJobPhotos";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import {
  vehicleLabel, APPOINTMENT_STATUS_LABEL, type AppointmentStatus, type JobPhoto,
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

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const collected = (i: { status: string; total: number; deposit_amount: number }) =>
  i.status === "paid" ? i.total : i.status === "deposit_paid" ? i.deposit_amount : 0;

export default function CustomerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { customers, loading, ready, update, remove } = useCustomers();
  const { appointments } = useAppointments();
  const { invoices } = useInvoices();
  const { services } = useServices();
  // Also loaded inside VehiclesCard; the hook is cheap and scoped per customer,
  // and the header/stats need the count before that card renders.
  const { vehicles } = useVehicles(id || null);
  const { photos } = useJobPhotos(id || null);
  const { role } = useAuth();
  const ent = useEntitlements();

  const canManage = role !== "employee";
  const customer = customers.find((c) => c.id === id) ?? null;

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
   * The whole business profile, derived from jobs + invoices + the service
   * catalog. Nothing here is stored on the customer record — lifetime value, the
   * health score, the loyalty tier, visit cadence, the favourite service and the
   * recommendations are all computed, so they stay correct with zero upkeep.
   */
  const p = useMemo(() => {
    const spent = myInvoices.reduce((s, i) => s + collected(i), 0);
    const done = history.filter((a) => a.status === "completed");
    const cancelled = history.filter((a) => a.status === "cancelled" || a.status === "no_show");
    const now = Date.now();
    const upcoming = history
      .filter((a) => new Date(a.scheduled_at).getTime() >= now && (a.status === "scheduled" || a.status === "confirmed"))
      .slice(-1)[0] ?? null;

    const last = done[0]?.scheduled_at ?? null;
    const daysSince = last ? Math.floor((now - new Date(last).getTime()) / 86_400_000) : null;
    const visits = done.length;
    const avgTicket = visits ? spent / visits : 0;
    const repeatRate = history.length ? (Math.max(0, visits - 1) / history.length) * 100 : 0;
    const cancelRate = history.length ? (cancelled.length / history.length) * 100 : 0;

    // Visit cadence — average days between completed visits.
    const times = done.map((a) => new Date(a.scheduled_at).getTime()).sort((a, b) => a - b);
    let cadence: number | null = null;
    if (times.length >= 2) {
      let sum = 0;
      for (let i = 1; i < times.length; i++) sum += (times[i] - times[i - 1]) / 86_400_000;
      cadence = Math.round(sum / (times.length - 1));
    }

    // Favourite service — most-booked across all appointments.
    const counts = new Map<string, number>();
    for (const a of history) {
      const n = a.service?.name;
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    let favorite: string | null = null;
    let favN = 0;
    for (const [n, c] of counts) if (c > favN) { favN = c; favorite = n; }

    // Loyalty / membership tier — earned, not assigned.
    const tier =
      spent >= 1500 || visits >= 10
        ? { label: "VIP", tone: "purple" as const, icon: Crown, perk: "Priority booking + loyalty perks" }
        : spent >= 600 || visits >= 5
          ? { label: "Gold", tone: "orange" as const, icon: Award, perk: "Earned through repeat business" }
          : visits >= 2
            ? { label: "Silver", tone: "blue" as const, icon: Star, perk: "A returning customer" }
            : { label: "New", tone: "green" as const, icon: UserPlus, perk: "Just getting started" };

    // Health factors (each 0–100) → a weighted health score.
    const cad = cadence ?? 45;
    const recency = visits === 0 ? 50 : daysSince == null ? 50 : daysSince <= cad ? 100 : daysSince <= cad * 2 ? 62 : daysSince <= cad * 3 ? 32 : 10;
    const frequency = Math.min(visits, 8) / 8 * 100;
    const value = Math.min(spent / 1500, 1) * 100;
    const loyalty = clamp(repeatRate, 0, 100);
    let health = visits === 0
      ? 52
      : Math.round(recency * 0.35 + frequency * 0.2 + value * 0.25 + loyalty * 0.2 - cancelRate * 0.15);
    health = clamp(health, 4, 99);
    const healthState =
      visits === 0 ? { label: "New customer", tone: "blue" as const }
        : health >= 80 ? { label: "Excellent", tone: "green" as const }
          : health >= 60 ? { label: "Healthy", tone: "green" as const }
            : health >= 40 ? { label: "Needs attention", tone: "orange" as const }
              : health >= 22 ? { label: "At risk", tone: "orange" as const }
                : { label: "Dormant", tone: "red" as const };

    // Recommended services — from the catalogue, ones they've not booked yet.
    const booked = new Set([...counts.keys()].map((n) => n.toLowerCase()));
    const untried = services
      .filter((s) => s.active !== false && !booked.has(s.name.toLowerCase()))
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);
    const dueForFavorite = Boolean(favorite && cadence && daysSince != null && daysSince >= cadence);

    return {
      spent, visits, last, daysSince, upcoming, avgTicket, repeatRate, cancelRate,
      cancelled: cancelled.length, appointments: history.length, cadence, favorite, favN,
      tier, health, healthState, factors: { recency, frequency, value, loyalty },
      untried, dueForFavorite,
    };
  }, [myInvoices, history, services, id]);

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

  const first = customer.name.trim().split(/\s+/)[0] || customer.name;

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

  // Rule-based recommendations ("AI recommendations") — computed from live data,
  // each only surfaced when the data supports it. Capped so it stays sharp.
  const recs = buildRecs(p, first);

  return (
    <div className="animate-fade-up">
      <BackLink />

      {/* ---- Header: identity, tier, and one-thumb actions --------------- */}
      <section className="surface relative mb-5 mt-3 overflow-hidden rounded-[20px]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-paint-gloss opacity-30" />
        <div aria-hidden className={cn("pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-[90px]", TONE[p.tier.tone].glow)} />
        <div className="relative flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet text-[21px] font-bold uppercase text-white shadow-glow">
              {initials(customer.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[24px] font-bold leading-tight tracking-tight">{customer.name}</h1>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ring-1 ring-inset", TONE[p.tier.tone].chip)}>
                  <p.tier.icon className="h-3 w-3" />{p.tier.label} member
                </span>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ring-1 ring-inset", TONE[p.healthState.tone].chip)}>
                  <Heart className="h-3 w-3" />{p.healthState.label}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink2">
                {customer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-ink3" />{customer.phone}</span>}
                {customer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-ink3" />{customer.email}</span>}
                {customer.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-ink3" />{customer.address}</span>}
                {!customer.phone && !customer.email && !customer.address && <span className="text-ink3">No contact details yet</span>}
              </div>
            </div>
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

          {/* relationship dates */}
          <div className="grid gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
            <HeaderFact icon={UserPlus} label="Customer since" value={fmtDate(customer.created_at)} />
            <HeaderFact icon={CalendarCheck} label="Last appointment"
              value={p.last ? fmtDate(p.last) : "No visits yet"}
              hint={p.daysSince !== null ? `${p.daysSince} days ago` : undefined} />
            <HeaderFact icon={CalendarClock} label="Next appointment"
              value={p.upcoming ? fmtDateTime(p.upcoming.scheduled_at) : "Nothing booked"}
              tone={p.upcoming ? "text-success" : undefined} />
          </div>

          {/* quick actions — tel:/sms:/mailto: work on every device */}
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <QuickAction icon={Phone} label="Call" href={customer.phone ? `tel:${customer.phone}` : undefined} />
            <QuickAction icon={MessageSquare} label="Text" href={customer.phone ? `sms:${customer.phone}` : undefined} />
            <QuickAction icon={Mail} label="Email" href={customer.email ? `mailto:${customer.email}` : undefined} />
            {canManage && <QuickAction icon={Plus} label="Book appointment" onClick={() => navigate("/appointments")} primary />}
            {canManage && <QuickAction icon={ReceiptText} label="Create invoice" onClick={() => navigate("/invoices")} />}
            <QuickAction icon={Pencil} label="Edit" onClick={openEdit} />
          </div>
        </div>
      </section>

      {/* ---- Insight KPIs ------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={DollarSign} tone="green" label="Lifetime value" value={money(p.spent)} sub={p.visits ? `${money(p.avgTicket)} avg ticket` : "No revenue yet"} />
        <StatCard icon={CalendarCheck} tone="blue" label="Total visits" value={String(p.visits)} sub={`${p.appointments} appointments`} />
        <StatCard icon={Repeat} tone="purple" label="Visit frequency" value={p.cadence ? `${p.cadence}d` : "—"} sub={p.cadence ? "between visits" : "Not enough data"} />
        <StatCard icon={Wrench} tone="orange" label="Favorite service" value={p.favorite ?? "—"} sub={p.favorite ? `Booked ${p.favN}×` : "No bookings yet"} />
        <StatCard icon={ReceiptText} tone="green" label="Avg ticket" value={money(p.avgTicket)} sub="Per completed job" />
        <StatCard icon={TrendingUp} tone="blue" label="Repeat rate" value={`${Math.round(p.repeatRate)}%`} sub="Return bookings" />
        <StatCard icon={Car} tone="purple" label="Vehicles" value={String(vehicles.length)} sub="On file" />
        <StatCard icon={XCircle} tone="orange" label="Cancellations" value={`${Math.round(p.cancelRate)}%`} sub={`${p.cancelled} cancelled / no-show`} />
      </div>

      {/* ---- Main + sidebar (collapses to one column on mobile) ---------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* MAIN */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* AI recommendations */}
          <div className="surface relative overflow-hidden rounded-[20px] p-5 sm:p-6">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-paint-gloss opacity-30" />
            <div className="relative mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet text-white shadow-glow"><Sparkles className="h-[18px] w-[18px]" /></span>
              <div>
                <h2 className="font-display text-[16px] font-bold tracking-tight text-ink">AI recommendations</h2>
                <p className="text-[12px] text-ink3">Next best actions from this customer's data</p>
              </div>
            </div>
            {recs.length === 0 ? (
              <div className="rounded-xl bg-line2/40 px-4 py-6 text-center text-[13px] text-ink3">Nothing to flag — this relationship looks healthy.</div>
            ) : (
              <div className="relative flex flex-col gap-2.5">
                {recs.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-panel2/50 px-3.5 py-3 ring-1 ring-inset ring-line/60">
                    <span className={cn("mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg", TONE[r.tone].bubble)}>
                      <r.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ink">{r.title}</div>
                      <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink3">{r.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent appointments */}
          <Panel title="Recent appointments" subtitle={`${history.length} total`}
            action={history.length > 0 ? <Link to="/appointments" className="text-[12.5px] font-semibold text-brand-500">View all</Link> : undefined}>
            {!ent.hasFeature("customer_history") ? (
              <FeatureLocked feature="customer_history" title="Service history"
                description="See every past job, what was done, and what this customer has spent." compact />
            ) : history.length === 0 ? (
              <Empty art="garage" title="No jobs yet" body="Book this customer in and their history builds here." />
            ) : (
              <div className="divide-y divide-line2">
                {history.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Wrench className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">{a.service?.name ?? "Service"}</div>
                      <div className="truncate text-xs text-ink3">
                        {fmtDateTime(a.scheduled_at)}{a.vehicle ? ` · ${vehicleLabel(a.vehicle)}` : ""}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-[13px] font-semibold tnum">{money(a.price)}</span>
                    <span className={cn("hidden whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline", statusStyle[a.status])}>
                      {APPOINTMENT_STATUS_LABEL[a.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Service timeline */}
          <Panel title="Service timeline" subtitle="Everything that's happened, newest first">
            <ActivityTimeline
              createdAt={customer.created_at}
              appointments={history}
              invoices={myInvoices}
              photos={photos}
            />
          </Panel>

          {/* Photos */}
          <PhotosCard customerId={customer.id} gated={!ent.hasFeature("customer_history")} />
        </div>

        {/* SIDEBAR */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Health score */}
          <div className="surface relative overflow-hidden rounded-[20px] p-5 sm:p-6">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-paint-gloss opacity-30" />
            <div className="relative mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Gauge className="h-4 w-4" /></span>
              <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">Customer health</h2>
            </div>
            <div className="relative flex items-center gap-5">
              <Ring value={p.health} tone={p.healthState.tone} />
              <div className="min-w-0 flex-1">
                <div className={cn("text-[15px] font-bold", TONE[p.healthState.tone].text)}>{p.healthState.label}</div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink3">
                  {healthBlurb(p, first)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4">
              <FactorBar label="Recency" value={p.factors.recency} />
              <FactorBar label="Frequency" value={p.factors.frequency} />
              <FactorBar label="Spend" value={p.factors.value} />
              <FactorBar label="Loyalty" value={p.factors.loyalty} />
            </div>
          </div>

          {/* Membership & profile */}
          <div className="surface rounded-[20px] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <span className={cn("flex h-8 w-8 flex-none items-center justify-center rounded-xl", TONE[p.tier.tone].bubble)}><p.tier.icon className="h-4 w-4" /></span>
              <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">Membership</h2>
            </div>
            <div className={cn("flex items-center justify-between rounded-xl px-3.5 py-3 ring-1 ring-inset", TONE[p.tier.tone].soft)}>
              <div>
                <div className={cn("text-[15px] font-bold", TONE[p.tier.tone].text)}>{p.tier.label}</div>
                <div className="text-[11.5px] text-ink3">{p.tier.perk}</div>
              </div>
              <p.tier.icon className={cn("h-6 w-6", TONE[p.tier.tone].text)} />
            </div>
            <p className="mt-2 text-[11px] text-ink3">Auto-tier from lifetime spend and visits.</p>
            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
              <ProfileRow icon={Gift} label="Referral source" value={customer.referral_source || "Not recorded"} muted={!customer.referral_source} />
              <ProfileRow icon={UserPlus} label="Customer since" value={fmtDate(customer.created_at)} />
              <ProfileRow icon={DollarSign} label="Lifetime value" value={money(p.spent)} />
            </div>
          </div>

          {/* Recommended services */}
          <Panel title="Recommended services" subtitle="Upsell opportunities">
            {(p.untried.length === 0 && !p.dueForFavorite) ? (
              <div className="rounded-xl bg-line2/40 px-4 py-6 text-center text-[12.5px] text-ink3">They've tried your whole menu — nice.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {p.dueForFavorite && p.favorite && (
                  <RecoRow name={`${p.favorite} (due again)`} note={`Usually every ${p.cadence}d · last ${p.daysSince}d ago`} tone="green"
                    onBook={canManage ? () => navigate("/appointments") : undefined} />
                )}
                {p.untried.map((s) => (
                  <RecoRow key={s.id} name={s.name} note={`${money(s.price)} · never booked`} tone="purple"
                    onBook={canManage ? () => navigate("/appointments") : undefined} />
                ))}
              </div>
            )}
          </Panel>

          {/* Recent invoices */}
          <Panel title="Recent invoices" subtitle={myInvoices.length ? `${myInvoices.length} total` : undefined}
            action={myInvoices.length > 0 ? <Link to="/invoices" className="text-[12.5px] font-semibold text-brand-500">View all</Link> : undefined}>
            {myInvoices.length === 0 ? (
              <Empty art="receipt" title="No invoices yet" body="Invoices you create for this customer show up here." />
            ) : (
              <div className="divide-y divide-line2">
                {myInvoices.slice(0, 5).map((i) => (
                  <div key={i.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><ReceiptText className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{i.number ? `#${i.number}` : "Invoice"}</div>
                      <div className="truncate text-[11px] text-ink3">{fmtDate(i.issued_at || i.created_at)}</div>
                    </div>
                    <span className="whitespace-nowrap text-[12.5px] font-semibold tnum">{money(i.total)}</span>
                    <InvoiceBadge status={i.status} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Vehicles */}
          <VehiclesCard customerId={customer.id} canManage={canManage} />
        </div>
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
const TONE: Record<Tone, { text: string; bubble: string; chip: string; soft: string; glow: string; hex: string }> = {
  green:  { text: "text-success",   bubble: "bg-success/12 text-success",     chip: "bg-success/12 text-success ring-success/25",     soft: "bg-success/8 ring-success/20",     glow: "bg-success/20",    hex: "#17A867" },
  blue:   { text: "text-brand-500", bubble: "bg-brand-500/12 text-brand-500", chip: "bg-brand-500/12 text-brand-500 ring-brand-500/25", soft: "bg-brand-500/8 ring-brand-500/20", glow: "bg-brand-500/20", hex: "#2E7BFF" },
  purple: { text: "text-violet",    bubble: "bg-violet/12 text-violet",       chip: "bg-violet/12 text-violet ring-violet/25",       soft: "bg-violet/8 ring-violet/20",       glow: "bg-violet/20",     hex: "#7A5BE0" },
  orange: { text: "text-warning",   bubble: "bg-warning/12 text-warning",     chip: "bg-warning/12 text-warning ring-warning/25",     soft: "bg-warning/8 ring-warning/20",     glow: "bg-warning/20",    hex: "#E08A00" },
  red:    { text: "text-danger",    bubble: "bg-danger/12 text-danger",       chip: "bg-danger/12 text-danger ring-danger/25",       soft: "bg-danger/8 ring-danger/20",       glow: "bg-danger/20",     hex: "#E5484D" },
};

/* ---------------------------------------------------------- derivations */

type Insights = {
  spent: number; visits: number; daysSince: number | null; cadence: number | null;
  favorite: string | null; avgTicket: number; cancelRate: number;
  upcoming: { scheduled_at: string } | null;
  tier: { label: string }; untried: { id: string; name: string; price: number }[]; dueForFavorite: boolean;
};

function buildRecs(p: Insights, first: string) {
  const out: { icon: typeof Sparkles; tone: Tone; title: string; body: string }[] = [];

  if (p.visits === 0) {
    out.push({ icon: UserPlus, tone: "blue", title: "Get them booked", body: `${first} hasn't had their first detail yet. Book one to kick off the relationship.` });
  } else {
    if (p.cadence && p.daysSince != null && p.daysSince > p.cadence * 1.4) {
      out.push({ icon: Clock, tone: "orange", title: "Overdue for a visit", body: `Usually books every ${p.cadence} days — it's been ${p.daysSince}. A quick "ready to shine again?" text tends to land.` });
    } else if (p.daysSince != null && p.daysSince > 90) {
      out.push({ icon: Clock, tone: "orange", title: "Win them back", body: `${p.daysSince} days since ${first}'s last visit. Reach out with a returning-customer offer.` });
    }
    if (p.dueForFavorite && p.favorite) {
      out.push({ icon: Repeat, tone: "green", title: `Rebook ${p.favorite}`, body: `${first}'s go-to service is due again — an easy win to schedule.` });
    }
    if (p.untried[0]) {
      out.push({ icon: Sparkles, tone: "purple", title: `Upsell ${p.untried[0].name}`, body: `${first} has spent ${money(p.spent)} but never tried ${p.untried[0].name} (${money(p.untried[0].price)}). Strong upgrade candidate.` });
    }
    if (p.tier.label === "VIP") {
      out.push({ icon: Gift, tone: "green", title: "Reward your VIP", body: `Top-tier customer — a loyalty perk or referral bonus keeps ${first} coming back.` });
    }
    if (p.cancelRate > 25) {
      out.push({ icon: AlertTriangle, tone: "orange", title: "Cut the no-shows", body: `${Math.round(p.cancelRate)}% of bookings fell through. A reminder the day before helps.` });
    }
    if (p.upcoming) {
      out.push({ icon: CalendarClock, tone: "blue", title: "Next visit booked", body: `Confirmed for ${fmtDateTime(p.upcoming.scheduled_at)}. Prep the bay and any products.` });
    }
  }
  return out.slice(0, 4);
}

function healthBlurb(p: Insights, first: string) {
  if (p.visits === 0) return `${first} is new — no visit history yet.`;
  if (p.daysSince != null && p.cadence && p.daysSince > p.cadence * 1.5) return `Slipping — well past their usual ${p.cadence}-day rhythm.`;
  if (p.daysSince != null && p.daysSince > 120) return `Quiet for ${p.daysSince} days. Worth a nudge.`;
  return `${p.visits} visits, ${money(p.spent)} lifetime. Keep the rhythm going.`;
}

/* --------------------------------------------------------- small parts */

/** Two-letter monogram from the customer's name ("Marcus Webb" → "MW"). */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]);
}

/** An animated SVG health ring, brand→tone gradient. */
function Ring({ value, tone }: { value: number; tone: Tone }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamp(value, 0, 100) / 100);
  const hex = TONE[tone].hex;
  return (
    <div className="relative h-[76px] w-[76px] flex-none">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" className="stroke-line2" />
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          stroke={hex} strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[19px] font-bold leading-none tnum text-ink">{value}</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink3">/ 100</span>
      </div>
    </div>
  );
}

// Literal solid fills (kept as literal strings so Tailwind generates them).
const SOLID: Record<Tone, string> = {
  green: "bg-success", blue: "bg-brand-500", purple: "bg-violet", orange: "bg-warning", red: "bg-danger",
};

function FactorBar({ label, value }: { label: string; value: number }) {
  const v = clamp(Math.round(value), 0, 100);
  const tone: Tone = v >= 66 ? "green" : v >= 33 ? "orange" : "red";
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 flex-none text-[11.5px] font-medium text-ink3">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line2">
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", SOLID[tone])} style={{ width: `${v}%` }} />
      </div>
      <span className="w-8 flex-none text-right text-[11px] font-semibold tnum text-ink2">{v}</span>
    </div>
  );
}

function ProfileRow({ icon: Icon, label, value, muted }: { icon: typeof Gift; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-panel2 text-ink3"><Icon className="h-3.5 w-3.5" /></span>
      <span className="text-[12px] text-ink3">{label}</span>
      <span className={cn("ml-auto truncate text-[12.5px] font-semibold", muted ? "text-ink3" : "text-ink")}>{value}</span>
    </div>
  );
}

function RecoRow({ name, note, tone, onBook }: { name: string; note: string; tone: Tone; onBook?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-panel2/50 px-3 py-2.5 ring-1 ring-inset ring-line/60">
      <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-lg", TONE[tone].bubble)}><Wrench className="h-3.5 w-3.5" /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink">{name}</div>
        <div className="truncate text-[11px] text-ink3">{note}</div>
      </div>
      {onBook && (
        <button onClick={onBook} aria-label={`Book ${name}`}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 transition-colors hover:bg-brand-500/15">
          <ArrowUpRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
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

function HeaderFact({ icon: Icon, label, value, hint, tone }: {
  icon: typeof Phone; label: string; value: string; hint?: string; tone?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-panel2 text-ink3">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3">{label}</div>
        <div className={cn("mt-0.5 truncate text-[13px] font-semibold text-ink", tone)}>{value}</div>
        {hint && <div className="text-[11px] text-ink3">{hint}</div>}
      </div>
    </div>
  );
}

/** A quick action. Renders as a link for tel:/sms:/mailto:, a button otherwise.
 *  Disabled (not hidden) when the customer has no phone/email, so the row's
 *  shape stays stable and it's obvious what's missing. */
function QuickAction({ icon: Icon, label, href, onClick, primary }: {
  icon: typeof Phone; label: string; href?: string; onClick?: () => void; primary?: boolean;
}) {
  const cls = cn(
    "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors active:scale-[0.97]",
    primary
      ? "bg-brand-500 text-white shadow-glow hover:brightness-[1.06]"
      : "bg-panel2 text-ink2 ring-1 ring-inset ring-line hover:bg-line2 hover:text-ink"
  );
  if (href) return <a href={href} className={cls}><Icon className="h-4 w-4" />{label}</a>;
  if (onClick) return <button onClick={onClick} className={cls}><Icon className="h-4 w-4" />{label}</button>;
  return (
    <span className={cn(cls, "cursor-not-allowed opacity-45")} title={`No ${label.toLowerCase()} on file`}>
      <Icon className="h-4 w-4" />{label}
    </span>
  );
}

function StatCard({ icon: Icon, tone, label, value, sub }: {
  icon: typeof DollarSign; tone: Tone; label: string; value: string; sub: string;
}) {
  return (
    <div className="surface rounded-2xl p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-lg", TONE[tone].bubble)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">{label}</span>
      </div>
      <div className="mt-2.5 truncate font-display text-[20px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
      <div className="mt-1.5 truncate text-[11px] text-ink3">{sub}</div>
    </div>
  );
}

/** One chronological stream merged from jobs, invoices and photos. */
function ActivityTimeline({ createdAt, appointments, invoices, photos }: {
  createdAt: string;
  appointments: { id: string; scheduled_at: string; status: AppointmentStatus; price: number | null; service?: { name: string } | null }[];
  invoices: { id: string; number: string | null; status: string; total: number; issued_at: string; created_at: string }[];
  photos: JobPhoto[];
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
  for (const p of photos) {
    events.push({ at: p.created_at, icon: ImageIcon, tone: "purple", title: "Photo uploaded", meta: p.caption ?? undefined });
  }

  const sorted = events.sort((a, b) => b.at.localeCompare(a.at));

  if (sorted.length <= 1) {
    return <Empty art="chart" title="Nothing has happened yet" body="Book this customer in and their whole history builds here automatically." />;
  }

  return (
    <ol className="relative ml-1 border-l border-line">
      {sorted.map((e, i) => (
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

/** A borderless section: heading (+ optional subtitle / right-aligned action), then content. */
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

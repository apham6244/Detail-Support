import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Car, Pencil, Plus, ReceiptText, CalendarClock, Wrench, DollarSign,
  Repeat, CalendarCheck, ShieldCheck, Sparkles, Gauge, Clock, Image as ImageIcon,
  X as XIcon, User, Trophy, CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { money } from "@/components/ui/data";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { EmptyArt, type EmptyArtVariant } from "@/components/ui/EmptyArt";
import { useVehicle } from "@/hooks/useVehicle";
import { useCustomers } from "@/hooks/useCustomers";
import { useAppointments } from "@/hooks/useAppointments";
import { useJobPhotos } from "@/hooks/useJobPhotos";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/lib/auth";
import {
  vehicleLabel, APPOINTMENT_STATUS_LABEL, type AppointmentStatus,
  type JobPhoto, type Vehicle,
} from "@/lib/models";
import type { VehicleInput } from "@/hooks/useVehicles";
import { cn } from "@/lib/cn";

const statusStyle: Record<AppointmentStatus, string> = {
  scheduled: "text-brand-500 bg-brand-500/10",
  confirmed: "text-violet bg-violet/10",
  in_progress: "text-warning bg-warning/10",
  completed: "text-success bg-success/10",
  cancelled: "text-ink3 bg-line2",
  no_show: "text-danger bg-danger/10",
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const initials = (n: string) => { const p = n.trim().split(/\s+/).filter(Boolean); return (p.length <= 1 ? (p[0] ?? "?").slice(0, 2) : p[0][0] + p[p.length - 1][0]); };

/**
 * Cadence catalogue used for maintenance recommendations. Each rule fires off
 * the vehicle's most recent job whose service name matches a keyword — so the
 * advice is derived from real history, never invented.
 */
const CADENCE: { match: RegExp; label: string; days: number }[] = [
  { match: /wash|maintenance/i, label: "Maintenance wash", days: 30 },
  { match: /interior/i, label: "Interior refresh", days: 90 },
  { match: /ceramic|coating/i, label: "Ceramic maintenance", days: 120 },
  { match: /full detail|paint correction|decontam/i, label: "Paint decontamination", days: 180 },
];

export default function VehicleDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { vehicle, loading, update } = useVehicle(id || null);
  const { customers } = useCustomers();
  const { appointments } = useAppointments();
  const { members } = useMembers();

  const customer = vehicle ? customers.find((c) => c.id === vehicle.customer_id) ?? null : null;
  const { photos } = useJobPhotos(vehicle?.customer_id ?? null);

  const canManage = role !== "employee";
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<VehicleInput>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<JobPhoto | null>(null);

  const memberName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of members) m[x.user_id] = x.name;
    return m;
  }, [members]);

  const jobs = useMemo(
    () => appointments.filter((a) => a.vehicle_id === id).sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)),
    [appointments, id]
  );
  const vehPhotos = useMemo(() => photos.filter((p) => p.vehicle_id === id), [photos, id]);

  const d = useMemo(() => {
    const done = jobs.filter((a) => a.status === "completed");
    const revenue = done.reduce((s, a) => s + (a.price ?? 0), 0);
    const dates = done.map((a) => new Date(a.scheduled_at).getTime()).sort((a, b) => a - b);
    let avgGap = 0;
    if (dates.length >= 2) {
      let total = 0;
      for (let i = 1; i < dates.length; i++) total += dates[i] - dates[i - 1];
      avgGap = Math.round(total / (dates.length - 1) / 86_400_000);
    }
    // service mix
    const byService: Record<string, { count: number; revenue: number }> = {};
    for (const a of done) {
      const n = a.service?.name ?? "Service";
      (byService[n] ??= { count: 0, revenue: 0 });
      byService[n].count++; byService[n].revenue += a.price ?? 0;
    }
    const ranked = Object.entries(byService).sort((a, b) => b[1].count - a[1].count);
    const topService = ranked[0]?.[0] ?? null;
    const highest = done.reduce((m, a) => Math.max(m, a.price ?? 0), 0);

    // derived protection status from what's actually been performed
    const names = done.map((a) => a.service?.name?.toLowerCase() ?? "");
    const ceramic = names.some((n) => n.includes("ceramic") || n.includes("coating"));
    const ppf = names.some((n) => n.includes("ppf") || n.includes("paint protection") || n.includes("film"));

    return {
      done, visits: done.length, revenue, avgTicket: done.length ? revenue / done.length : 0,
      last: done[0]?.scheduled_at ?? null, avgGap, ranked, topService, highest, ceramic, ppf,
    };
  }, [jobs]);

  // maintenance recommendations, derived from last-of-type + cadence
  const recs = useMemo(() => {
    const now = Date.now();
    return CADENCE.map((c) => {
      const lastOf = d.done.find((a) => c.match.test(a.service?.name ?? ""));
      if (!lastOf) return null;
      const due = new Date(lastOf.scheduled_at).getTime() + c.days * 86_400_000;
      const daysLeft = Math.round((due - now) / 86_400_000);
      return { label: c.label, daysLeft, every: c.days };
    }).filter(Boolean) as { label: string; daysLeft: number; every: number }[];
  }, [d.done]);

  if (loading && !vehicle) return <PageSkeleton variant="detail" />;
  if (!vehicle) {
    return (
      <div className="animate-fade-up">
        <BackLink />
        <div className="mt-6 border-y border-line px-6 py-16 text-center">
          <div className="text-[15px] font-semibold">Vehicle not found</div>
          <div className="mt-1 text-[13px] text-ink3">It may have been removed, or you may not have access to it.</div>
        </div>
      </div>
    );
  }

  const heroPhoto = vehPhotos[0]?.url ?? null;

  const openEdit = () => {
    setForm({
      year: vehicle.year, make: vehicle.make, model: vehicle.model, color: vehicle.color,
      license_plate: vehicle.license_plate, vin: vehicle.vin, notes: vehicle.notes,
    });
    setErr(null); setEditOpen(true);
  };
  const save = async () => {
    setBusy(true); setErr(null);
    try { await update(form); setEditOpen(false); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="animate-fade-up">
      <BackLink to={customer ? `/customers/${customer.id}` : "/customers"} label={customer ? customer.name : "Customers"} />

      {/* ---- Hero ---------------------------------------------------------- */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="surface relative mt-3 overflow-hidden rounded-[22px]"
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,360px)_1fr]">
          {/* photo */}
          <div className="relative h-52 overflow-hidden bg-gradient-to-br from-carbon-900 to-carbon-950 lg:h-auto">
            {heroPhoto ? (
              <img src={heroPhoto} alt={vehicleLabel(vehicle)} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Car className="h-16 w-16 text-white/15" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/20" />
          </div>

          {/* identity */}
          <div className="relative p-5 sm:p-6">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-paint-gloss opacity-30" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight">
                    {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink2">
                    {vehicle.color && <span className="inline-flex items-center gap-1.5"><CircleDot className="h-3.5 w-3.5 text-ink3" />{vehicle.color}</span>}
                    {vehicle.license_plate && <span className="rounded-md bg-panel2 px-2 py-0.5 font-mono text-[12px] font-semibold ring-1 ring-inset ring-line">{vehicle.license_plate}</span>}
                    {vehicle.vin && <span className="truncate font-mono text-[11.5px] text-ink3">VIN {vehicle.vin}</span>}
                  </div>
                </div>
                {d.ceramic && (
                  <span className="inline-flex flex-none items-center gap-1 rounded-full bg-violet/12 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-violet ring-1 ring-inset ring-violet/25">
                    <ShieldCheck className="h-3 w-3" />Ceramic
                  </span>
                )}
              </div>

              {/* owner */}
              {customer && (
                <Link to={`/customers/${customer.id}`} className="mt-4 inline-flex items-center gap-2.5 rounded-xl bg-panel2/60 px-3 py-2 ring-1 ring-inset ring-line/60 transition-colors hover:bg-panel2">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet text-[11px] font-bold uppercase text-white">
                    {initials(customer.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-ink">{customer.name}</div>
                    <div className="text-[11px] text-ink3">Owner · view profile</div>
                  </div>
                </Link>
              )}

              {/* quick actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                {canManage && <Qa icon={Plus} label="Schedule" primary onClick={() => navigate("/appointments")} />}
                {canManage && <Qa icon={ReceiptText} label="Create invoice" onClick={() => navigate("/invoices")} />}
                {canManage && customer && <Qa icon={ImageIcon} label="Upload photos" onClick={() => navigate(`/customers/${customer.id}`)} />}
                <Qa icon={Pencil} label="Edit" onClick={openEdit} />
                <Qa icon={Wrench} label="Print history" onClick={() => window.print()} />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ---- Overview cards ----------------------------------------------- */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ov icon={Wrench} tone="blue" label="Total services" value={String(d.visits)} sub={`${jobs.length} booked`} />
        <Ov icon={DollarSign} tone="green" label="Lifetime revenue" value={money(d.revenue)} sub={`${money(d.avgTicket)} avg`} />
        <Ov icon={CalendarCheck} tone="purple" label="Last detail" value={d.last ? fmtDate(d.last) : "—"} sub={d.last ? "Most recent" : "No visits yet"} />
        <Ov icon={Repeat} tone="orange" label="Avg between visits" value={d.avgGap ? `${d.avgGap} days` : "—"} sub={d.visits >= 2 ? "Visit cadence" : "Need 2+ visits"} />
        <Ov icon={CalendarClock} tone="blue" label="Next recommended"
          value={recs[0] ? recs[0].label : "—"} sub={recs[0] ? countdown(recs[0].daysLeft) : "Build history first"} />
        <Ov icon={ShieldCheck} tone="purple" label="Ceramic coating" value={d.ceramic ? "Applied" : "None"} sub="From service history" />
        <Ov icon={Sparkles} tone="green" label="Paint protection" value={d.ppf ? "PPF" : "None"} sub="From service history" />
        <Ov icon={Gauge} tone="orange" label="Highest job" value={money(d.highest)} sub="Single visit" />
      </div>

      {/* ---- Specs + Maintenance ------------------------------------------ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Specifications" subtitle="On file for this vehicle" icon={Car}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5">
            <Spec label="Year" value={vehicle.year ? String(vehicle.year) : "—"} />
            <Spec label="Make" value={vehicle.make ?? "—"} />
            <Spec label="Model" value={vehicle.model ?? "—"} />
            <Spec label="Color" value={vehicle.color ?? "—"} />
            <Spec label="License plate" value={vehicle.license_plate ?? "—"} mono />
            <Spec label="VIN" value={vehicle.vin ?? "—"} mono />
          </dl>
          {vehicle.notes && (
            <div className="mt-4 rounded-xl bg-panel2/50 px-3.5 py-3 ring-1 ring-inset ring-line/60">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink2">{vehicle.notes}</p>
            </div>
          )}
        </Panel>

        <Panel title="Maintenance recommendations" subtitle="Calculated from this vehicle's history" icon={CalendarClock}>
          {recs.length === 0 ? (
            <Empty art="garage" title="No recommendations yet" body="Once a few services are logged, upcoming maintenance shows here with countdowns." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {recs.sort((a, b) => a.daysLeft - b.daysLeft).map((r) => {
                const overdue = r.daysLeft < 0;
                const soon = r.daysLeft >= 0 && r.daysLeft <= 14;
                return (
                  <div key={r.label} className="flex items-center gap-3 rounded-2xl bg-panel2/50 px-3.5 py-3 ring-1 ring-inset ring-line/60">
                    <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-xl",
                      overdue ? "bg-danger/12 text-danger" : soon ? "bg-warning/12 text-warning" : "bg-brand-500/12 text-brand-500")}>
                      <Wrench className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{r.label}</div>
                      <div className="text-[11px] text-ink3">every {r.every} days</div>
                    </div>
                    <span className={cn("flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold",
                      overdue ? "bg-danger/12 text-danger" : soon ? "bg-warning/12 text-warning" : "bg-success/12 text-success")}>
                      {countdown(r.daysLeft)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Revenue analytics -------------------------------------------- */}
      <div className="mt-4">
        <Panel title="Revenue analytics" subtitle="What this vehicle is worth to the shop" icon={DollarSign}>
          {d.visits === 0 ? (
            <Empty art="chart" title="No revenue yet" body="Completed jobs on this vehicle roll up here." />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat icon={DollarSign} tone="green" label="Lifetime" value={money(d.revenue)} />
                <MiniStat icon={ReceiptText} tone="blue" label="Avg invoice" value={money(d.avgTicket)} />
                <MiniStat icon={Repeat} tone="purple" label="Total visits" value={String(d.visits)} />
                <MiniStat icon={Trophy} tone="orange" label="Highest job" value={money(d.highest)} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Service mix</div>
                <div className="flex flex-col gap-2">
                  {d.ranked.slice(0, 5).map(([name, s], i) => {
                    const max = d.ranked[0][1].revenue || 1;
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-lg font-display text-[12px] font-bold",
                          i === 0 ? "bg-warning/15 text-warning" : "bg-line2 text-ink3")}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-[12.5px] font-semibold text-ink">{name}</span>
                            <span className="ml-auto flex-none text-[11px] text-ink3">{s.count}×</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line2">
                            <div className="h-full rounded-full bg-gradient-to-r from-success/80 to-success" style={{ width: `${(s.revenue / max) * 100}%` }} />
                          </div>
                        </div>
                        <span className="flex-none text-[12px] font-bold tnum text-ink">{money(s.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Service timeline --------------------------------------------- */}
      <div className="mt-4">
        <Panel title="Service timeline" subtitle={`${jobs.length} appointment${jobs.length === 1 ? "" : "s"}`} icon={Wrench}>
          {jobs.length === 0 ? (
            <Empty art="garage" title="No services yet" body="Book this vehicle in and every visit is logged here." />
          ) : (
            <ol className="relative ml-1 border-l border-line">
              {jobs.map((a) => {
                const shots = vehPhotos.filter((p) => p.appointment_id === a.id);
                return (
                  <li key={a.id} className="relative py-3.5 pl-6">
                    <span className={cn("absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-panel", statusStyle[a.status])}>
                      <Wrench className="h-3 w-3" />
                    </span>
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-ink">{a.service?.name ?? "Service"}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink3">
                          <span>{fmtDateTime(a.scheduled_at)}</span>
                          {a.assigned_to && memberName[a.assigned_to] && (
                            <span className="inline-flex items-center gap-1"><span className="text-line2">·</span><User className="h-3 w-3" />{memberName[a.assigned_to]}</span>
                          )}
                        </div>
                        {a.notes && <div className="mt-1 text-[11.5px] text-ink2">{a.notes}</div>}
                      </div>
                      <span className="whitespace-nowrap text-[13px] font-bold tnum">{money(a.price)}</span>
                      <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", statusStyle[a.status])}>
                        {APPOINTMENT_STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    {shots.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {shots.map((p) => (
                          <button key={p.id} onClick={() => setLightbox(p)}
                            className="h-16 w-16 overflow-hidden rounded-lg ring-1 ring-inset ring-line transition-transform hover:scale-105">
                            {p.url ? <img src={p.url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-panel2"><ImageIcon className="h-4 w-4 text-ink3" /></div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      {/* ---- Photo gallery ------------------------------------------------- */}
      <div className="mt-4">
        <Panel title="Photo gallery" subtitle={`${vehPhotos.length} photo${vehPhotos.length === 1 ? "" : "s"}`} icon={ImageIcon}>
          {vehPhotos.length === 0 ? (
            <Empty art="photo" title="No photos yet" body="Upload shots from this vehicle's jobs and they gather here, grouped by visit." />
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {vehPhotos.map((p) => (
                <button key={p.id} onClick={() => setLightbox(p)}
                  className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-inset ring-line transition-transform hover:scale-[1.03] hover:shadow-lift">
                  {p.url ? <img src={p.url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-panel2"><ImageIcon className="h-5 w-5 text-ink3" /></div>}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-[10px] font-medium text-white">{fmtDate(p.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Master activity timeline ------------------------------------- */}
      <div className="mt-4">
        <Panel title="Activity timeline" subtitle="Everything, in order" icon={Clock}>
          <VehicleTimeline addedAt={(vehicle as { created_at?: string }).created_at ?? jobs[jobs.length - 1]?.scheduled_at ?? new Date().toISOString()}
            jobs={jobs} photos={vehPhotos} />
        </Panel>
      </div>

      {/* Edit */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit vehicle"
        footer={<><Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Year"><input className="input" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Make"><input className="input" value={form.make ?? ""} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Field>
          <Field label="Model"><input className="input" value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
          <Field label="Color"><input className="input" value={form.color ?? ""} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
          <Field label="License plate"><input className="input" value={form.license_plate ?? ""} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} /></Field>
          <Field label="VIN"><input className="input" value={form.vin ?? ""} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          {err && <div className="col-span-2 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{err}</div>}
        </div>
      </Modal>

      {lightbox && <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function BackLink({ to = "/customers", label = "Customers" }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink3 hover:text-brand-500">
      <ArrowLeft className="h-4 w-4" />{label}
    </Link>
  );
}

function Qa({ icon: Icon, label, onClick, primary }: { icon: typeof Car; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className={cn(
      "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors",
      primary ? "bg-brand-500 text-white shadow-glow hover:brightness-[1.06]" : "bg-panel2 text-ink2 ring-1 ring-inset ring-line hover:bg-line2 hover:text-ink")}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );
}

const TONE = { green: "bg-success/12 text-success", blue: "bg-brand-500/12 text-brand-500", purple: "bg-violet/12 text-violet", orange: "bg-warning/12 text-warning" } as const;

function Ov({ icon: Icon, tone, label, value, sub }: { icon: typeof Car; tone: keyof typeof TONE; label: string; value: string; sub: string }) {
  return (
    <div className="surface rounded-2xl p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-lg", TONE[tone])}><Icon className="h-3.5 w-3.5" /></span>
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">{label}</span>
      </div>
      <div className="mt-2.5 truncate font-display text-[19px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
      <div className="mt-1.5 truncate text-[11px] text-ink3">{sub}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, tone, label, value }: { icon: typeof Car; tone: keyof typeof TONE; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-panel2/60 p-3.5 ring-1 ring-inset ring-line/60">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", TONE[tone])}><Icon className="h-3.5 w-3.5" /></span>
      <div className="mt-2.5 font-display text-[19px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
      <div className="mt-1.5 text-[11px] text-ink3">{label}</div>
    </div>
  );
}

function Spec({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3">{label}</dt>
      <dd className={cn("mt-0.5 text-[13.5px] font-semibold text-ink", mono && value !== "—" && "font-mono text-[12.5px]")}>{value}</dd>
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: typeof Car; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="surface relative overflow-hidden rounded-[20px]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-paint-gloss opacity-25" />
      <div className="relative p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon className="h-4 w-4" /></span>
          <div><h2 className="font-display text-[16px] font-bold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-ink3">{subtitle}</p>}</div>
        </div>
        {children}
      </div>
    </motion.section>
  );
}

function Empty({ art, title, body }: { art: EmptyArtVariant; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <EmptyArt variant={art} className="w-[130px]" />
      <div><div className="text-[14px] font-semibold text-ink">{title}</div>
        <p className="mx-auto mt-1 max-w-[20rem] text-[12.5px] leading-relaxed text-ink3">{body}</p></div>
    </div>
  );
}

function VehicleTimeline({ addedAt, jobs, photos }: {
  addedAt: string;
  jobs: { id: string; scheduled_at: string; status: AppointmentStatus; price: number | null; service?: { name: string } | null }[];
  photos: JobPhoto[];
}) {
  type Ev = { at: string; icon: typeof Car; tone: keyof typeof TONE; title: string; meta?: string };
  const events: Ev[] = [{ at: addedAt, icon: Car, tone: "blue", title: "Vehicle added", meta: "On file" }];
  for (const a of jobs) {
    const done = a.status === "completed";
    events.push({ at: a.scheduled_at, icon: Wrench, tone: done ? "green" : "blue",
      title: done ? `${a.service?.name ?? "Service"} completed` : `${a.service?.name ?? "Appointment"} — ${APPOINTMENT_STATUS_LABEL[a.status]}`,
      meta: a.price != null ? money(a.price) : undefined });
  }
  for (const p of photos) events.push({ at: p.created_at, icon: ImageIcon, tone: "purple", title: "Photo uploaded", meta: p.caption ?? undefined });
  const sorted = events.sort((a, b) => b.at.localeCompare(a.at));
  if (sorted.length <= 1) return <Empty art="chart" title="Nothing logged yet" body="The vehicle's full history builds here as you work on it." />;
  return (
    <ol className="relative ml-1 border-l border-line">
      {sorted.map((e, i) => (
        <li key={i} className="relative flex items-start gap-3 py-3 pl-6">
          <span className={cn("absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-panel", TONE[e.tone])}><e.icon className="h-3 w-3" /></span>
          <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-ink">{e.title}</div>
            <div className="mt-0.5 text-[11.5px] text-ink3">{fmtDateTime(e.at)}</div></div>
          {e.meta && <span className="flex-none whitespace-nowrap text-[12.5px] font-semibold tnum text-ink2">{e.meta}</span>}
        </li>
      ))}
    </ol>
  );
}

function Lightbox({ photo, onClose }: { photo: JobPhoto; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <XIcon className="h-5 w-5" />
      </button>
      {photo.url && <img src={photo.url} alt={photo.caption ?? ""} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" />}
      {photo.caption && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-[13px] text-white">{photo.caption}</div>}
    </div>,
    document.body
  );
}

function countdown(daysLeft: number) {
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === 0) return "Due today";
  if (daysLeft < 60) return `in ${daysLeft} days`;
  return `in ${Math.round(daysLeft / 30)} months`;
}

export type { Vehicle };

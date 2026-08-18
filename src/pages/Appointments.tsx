import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Plus, Trash2, UserRound, ChevronLeft, ChevronRight,
  Clock, Bell, BellPlus, Car, Wrench, StickyNote, Send, AlertTriangle,
  Eye, Pencil, Copy, MessageSquare, Navigation, DollarSign, CalendarCheck, Hourglass,
  Armchair, Sparkles, Lightbulb, Cog, Wind, Brush, Disc3, Droplets,
  Loader2, CalendarDays, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { Th, Td, IconBtn, EmptyState, SignInPrompt, money } from "@/components/ui/data";
import { confirm, toast } from "@/components/ui/feedback";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useAppointments, type AppointmentInput } from "@/hooks/useAppointments";
import { useCustomers } from "@/hooks/useCustomers";
import { useServices } from "@/hooks/useServices";
import { useVehicles } from "@/hooks/useVehicles";
import { useMembers } from "@/hooks/useMembers";
import { useReminders } from "@/hooks/useReminders";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { useDelivery, sendReminderNow } from "@/lib/notify";
import {
  APPOINTMENT_STATUS_LABEL, vehicleLabel,
  type Appointment, type AppointmentStatus,
} from "@/lib/models";
import { cn } from "@/lib/cn";

type View = "day" | "week" | "month" | "list";

const STATUSES: AppointmentStatus[] = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"];

const statusStyle: Record<AppointmentStatus, string> = {
  scheduled: "text-brand-500 bg-brand-500/10",
  confirmed: "text-violet bg-violet/10",
  in_progress: "text-warning bg-warning/10",
  completed: "text-success bg-success/10",
  cancelled: "text-ink3 bg-line2",
  no_show: "text-danger bg-danger/10",
};
const statusDot: Record<AppointmentStatus, string> = {
  scheduled: "bg-brand-500", confirmed: "bg-violet", in_progress: "bg-warning",
  completed: "bg-success", cancelled: "bg-ink3", no_show: "bg-danger",
};
/* Status is the ONE semantic colour on a card — a left accent bar (same status
   palette as the pill), so a column scans by status without extra colours. */
const statusBar: Record<AppointmentStatus, string> = {
  scheduled: "border-l-brand-500", confirmed: "border-l-violet", in_progress: "border-l-warning",
  completed: "border-l-success", cancelled: "border-l-ink3", no_show: "border-l-danger",
};
const fmtHours = (h: number) => `${h % 1 ? h.toFixed(1) : h}h`;

/* Consistent service colour system — a light tint + coloured left border + a
   subtle tinted icon per service type. Never a solid-colour card. */
type SvcTone = "blue" | "green" | "orange" | "purple" | "gray" | "red" | "teal" | "amber";
const SVC_TONE: Record<SvcTone, { borderL: string; bg: string; icon: string; badge: string; hoverBorder: string }> = {
  blue:   { borderL: "border-l-brand-500", bg: "bg-brand-500/[0.05]", icon: "text-brand-500", badge: "bg-brand-500/10 text-brand-500", hoverBorder: "hover:border-brand-500/40" },
  green:  { borderL: "border-l-success",   bg: "bg-success/[0.06]",   icon: "text-success",   badge: "bg-success/10 text-success",     hoverBorder: "hover:border-success/40" },
  orange: { borderL: "border-l-warning",   bg: "bg-warning/[0.06]",   icon: "text-warning",   badge: "bg-warning/10 text-warning",     hoverBorder: "hover:border-warning/40" },
  purple: { borderL: "border-l-violet",    bg: "bg-violet/[0.06]",    icon: "text-violet",    badge: "bg-violet/10 text-violet",       hoverBorder: "hover:border-violet/40" },
  gray:   { borderL: "border-l-ink3/40",   bg: "bg-panel2",           icon: "text-ink3",      badge: "bg-ink/[0.06] text-ink2",        hoverBorder: "hover:border-ink3/40" },
  red:    { borderL: "border-l-danger",    bg: "bg-danger/[0.06]",    icon: "text-danger",    badge: "bg-danger/10 text-danger",       hoverBorder: "hover:border-danger/40" },
  teal:   { borderL: "border-l-[#0D9488]", bg: "bg-[#0D9488]/[0.06]", icon: "text-[#0D9488]", badge: "bg-[#0D9488]/12 text-[#0D9488]", hoverBorder: "hover:border-[#0D9488]/40" },
  amber:  { borderL: "border-l-[#C79200]", bg: "bg-[#C79200]/[0.06]", icon: "text-[#B8860B]", badge: "bg-[#C79200]/12 text-[#B8860B]", hoverBorder: "hover:border-[#C79200]/40" },
};
/** Consistent service → colour, app-wide. Emerald Interior, Blue Full Detail,
 *  Orange Paint, Purple Ceramic, Gray Maintenance, Red Engine, Teal Odor,
 *  Amber Headlight. */
function serviceTone(name?: string | null): SvcTone {
  const n = (name ?? "").toLowerCase();
  if (n.includes("interior")) return "green";
  if (n.includes("ceramic") || n.includes("coating")) return "purple";
  if (n.includes("headlight")) return "amber";
  if (n.includes("engine")) return "red";
  if (n.includes("odor") || n.includes("odour")) return "teal";
  if (n.includes("paint") || n.includes("correction") || n.includes("polish")) return "orange";
  if (n.includes("maintenance") || n.includes("wash")) return "gray";
  if (n.includes("wheel") || n.includes("tire") || n.includes("tyre")) return "gray";
  if (n.includes("full") || n.includes("detail")) return "blue";
  if (n.includes("exterior")) return "orange";
  return "gray";
}
/** A simple, monochrome icon per service type. */
function serviceIcon(name?: string | null): LucideIcon {
  const n = (name ?? "").toLowerCase();
  if (n.includes("interior")) return Armchair;
  if (n.includes("ceramic") || n.includes("coating")) return Sparkles;
  if (n.includes("headlight")) return Lightbulb;
  if (n.includes("engine")) return Cog;
  if (n.includes("odor") || n.includes("odour")) return Wind;
  if (n.includes("paint") || n.includes("correction") || n.includes("polish")) return Brush;
  if (n.includes("wheel") || n.includes("tire") || n.includes("tyre")) return Disc3;
  if (n.includes("maintenance") || n.includes("wash")) return Droplets;
  if (n.includes("full") || n.includes("detail")) return Car;
  return Wrench;
}
const endTime = (iso: string, mins?: number | null) =>
  time(new Date(new Date(iso).getTime() + (mins ?? 60) * 60_000).toISOString());

const DAY = 86_400_000;
const key = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; };
const sameDay = (a: Date, b: Date) => key(a) === key(b);

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function defaultWhen() { const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return toLocalInput(d); }

/** Up-to-two-letter initials for the customer avatar chip. */
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/** One-thing-at-a-time booking wizard — same slide pattern as Add Service. */
const BOOK_STEPS = ["Customer", "Service", "Schedule", "Review"] as const;
const stepSlide = {
  enter: (d: number) => ({ opacity: 0, x: d >= 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
};

/** Booking-form field wrapper: a div-based label (so it can safely contain
 *  button-driven Comboboxes) with an optional required marker and right hint. */
function LabeledField({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: ReactNode; children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">
        <span>{label}</span>
        {required && <span className="text-danger" aria-hidden>*</span>}
        {hint && <span className="ml-auto font-medium normal-case tracking-normal text-ink3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function Appointments() {
  const { appointments, loading, ready, create, update, setStatus, remove, assign } = useAppointments();
  const { customers } = useCustomers();
  const { services } = useServices();
  const { members, byId } = useMembers();
  const reminders = useReminders();
  const { role } = useAuth();
  const ent = useEntitlements();

  const isManager = role === "owner" || role === "admin";
  const canAssign = isManager && ent.hasFeature("job_assignments");

  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);

  // form
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [when, setWhen] = useState(defaultWhen());
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookStep, setBookStep] = useState(0);
  const [bookDir, setBookDir] = useState(1);
  const { vehicles } = useVehicles(customerId || null);

  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const k = key(new Date(a.scheduled_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    m.forEach((list) => list.sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at)));
    return m;
  }, [appointments]);

  const custById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // ---- Booking form: option lists + service-driven auto-fill --------------
  const svcById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const vehById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: c.name, keywords: `${c.phone ?? ""} ${c.email ?? ""}` })),
    [customers],
  );
  const serviceOptions = useMemo(
    () => services.map((s) => ({ value: s.id, label: s.name, keywords: s.category ?? "" })),
    [services],
  );
  const vehicleOptions = useMemo(
    () => vehicles.map((v) => ({ value: v.id, label: vehicleLabel(v), keywords: `${v.license_plate ?? ""} ${v.color ?? ""}` })),
    [vehicles],
  );

  // Selecting a service auto-fills its default duration and price. Both stay
  // editable afterward; picking a different service re-seeds them.
  const pickService = (id: string) => {
    setServiceId(id);
    const s = services.find((x) => x.id === id);
    if (s) { setDuration(String(s.duration_min || 60)); setPrice(s.price != null ? s.price.toFixed(2) : ""); }
  };

  const datePart = when.slice(0, 10);
  const timePart = when.slice(11, 16);
  const whenValid = !Number.isNaN(new Date(when).getTime());
  const selectedService = svcById.get(serviceId);

  // The metric row always matches the CURRENT view's date scope (day/week/month
  // /list) — never a hardcoded "today" while a week is on screen.
  const scope = useMemo(() => {
    const CAP = 10; // ~10 working hours a day → "available" capacity
    if (view === "day") {
      const d = key(cursor);
      return { inRange: (iso: string) => key(iso) === d, capacityH: CAP, fourth: "avail" as const,
        labels: { jobs: "Today's jobs", booked: "Booked hours", fourth: "Available hours", revenue: "Revenue today" } };
    }
    if (view === "week") {
      const s = startOfWeek(cursor).getTime(); const e = s + 7 * DAY;
      return { inRange: (iso: string) => { const t = new Date(iso).getTime(); return t >= s && t < e; }, capacityH: CAP * 7, fourth: "avail" as const,
        labels: { jobs: "Jobs this week", booked: "Booked hours", fourth: "Available hours", revenue: "Revenue this week" } };
    }
    if (view === "month") {
      const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getTime();
      const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime();
      const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      return { inRange: (iso: string) => { const t = new Date(iso).getTime(); return t >= s && t < e; }, capacityH: CAP * days, fourth: "avail" as const,
        labels: { jobs: "Jobs this month", booked: "Booked hours", fourth: "Available hours", revenue: "Revenue this month" } };
    }
    // list — everything upcoming; capacity isn't meaningful over an open range,
    // so the 4th card becomes "Completed" instead of available hours.
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    return { inRange: (iso: string) => new Date(iso).getTime() >= startToday.getTime(), capacityH: 0, fourth: "completed" as const,
      labels: { jobs: "Upcoming jobs", booked: "Booked hours", fourth: "Completed", revenue: "Upcoming revenue" } };
  }, [view, cursor]);

  const scopeStats = useMemo(() => {
    const active = appointments.filter((a) => scope.inRange(a.scheduled_at) && a.status !== "cancelled" && a.status !== "no_show");
    const bookedH = active.reduce((s, a) => s + (a.duration_min ?? 60), 0) / 60;
    return {
      jobs: active.length,
      bookedH,
      revenue: active.reduce((s, a) => s + (a.price ?? 0), 0),
      completed: active.filter((a) => a.status === "completed").length,
      availH: Math.max(0, scope.capacityH - bookedH),
    };
  }, [appointments, scope]);

  // Double-booking guard: the first active appointment whose time window overlaps
  // the one being booked/edited. Non-blocking — a shop with two bays can override.
  const conflict = useMemo(() => {
    if (!when) return null;
    const start = new Date(when).getTime();
    if (Number.isNaN(start)) return null;
    const end = start + (Number(duration) || 60) * 60_000;
    for (const a of appointments) {
      if (editing && a.id === editing.id) continue;
      if (a.status === "cancelled" || a.status === "no_show") continue;
      const aStart = new Date(a.scheduled_at).getTime();
      const aEnd = aStart + (a.duration_min ?? 60) * 60_000;
      if (start < aEnd && aStart < end) return { appt: a, endsAt: aEnd };
    }
    return null;
  }, [when, duration, appointments, editing]);

  const live = detail ? appointments.find((a) => a.id === detail.id) ?? null : null;

  const openNew = (at?: Date) => {
    setEditing(null);
    setCustomerId(""); setVehicleId(""); setServiceId("");
    setWhen(at ? toLocalInput(new Date(at.setHours(9, 0, 0, 0))) : defaultWhen());
    setDuration("60"); setPrice(""); setNotes(""); setError(null);
    setBookStep(0); setBookDir(1);
    setFormOpen(true);
  };

  const openEdit = (a: Appointment) => {
    setEditing(a);
    setCustomerId(a.customer_id);
    setVehicleId(a.vehicle_id ?? "");
    setServiceId(a.service_id ?? "");
    setWhen(toLocalInput(new Date(a.scheduled_at)));
    setDuration(String(a.duration_min ?? 60));
    setPrice(a.price != null ? String(a.price) : "");
    setNotes(a.notes ?? "");
    setError(null);
    setBookStep(0);
    setBookDir(1);
    setDetail(null);
    setFormOpen(true);
  };

  // Duplicate → open the booking form pre-filled as a NEW job (same details,
  // adjustable time) rather than silently cloning into an overlap.
  const openDuplicate = (a: Appointment) => {
    setEditing(null);
    setCustomerId(a.customer_id);
    setVehicleId(a.vehicle_id ?? "");
    setServiceId(a.service_id ?? "");
    setWhen(toLocalInput(new Date(a.scheduled_at)));
    setDuration(String(a.duration_min ?? 60));
    setPrice(a.price != null ? String(a.price) : "");
    setNotes(a.notes ?? "");
    setError(null);
    setBookStep(0);
    setBookDir(1);
    setDetail(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!customerId) return setError("Choose a customer.");
    setBusy(true); setError(null);
    try {
      const svc = services.find((s) => s.id === serviceId);
      const input: AppointmentInput = {
        customer_id: customerId,
        vehicle_id: vehicleId || null,
        service_id: serviceId || null,
        scheduled_at: new Date(when).toISOString(),
        duration_min: Number(duration) || svc?.duration_min || 60,
        price: price ? Number(price) : null,
        notes: notes || null,
      };
      if (editing) await update(editing.id, input);
      else await create(input);
      setFormOpen(false);
      toast.success(editing ? "Job updated" : "Job booked");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  // Wizard: per-step validity, and slide navigation that preserves all input.
  const selectedVehicle = vehById.get(vehicleId) ?? null;
  const bookStepValid = [Boolean(customerId), Boolean(serviceId), whenValid && Number(duration) > 0, true];
  const gotoBook = (n: number, d: number) => { setBookDir(d); setBookStep(Math.max(0, Math.min(BOOK_STEPS.length - 1, n))); };
  const nextBook = () => { if (bookStepValid[bookStep]) gotoBook(bookStep + 1, 1); };
  const backBook = () => gotoBook(bookStep - 1, -1);

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  };

  const title = useMemo(() => {
    if (view === "month") return cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(cursor); const e = new Date(s.getTime() + 6 * DAY);
      return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    }
    if (view === "day") return cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    return "All upcoming";
  }, [view, cursor]);

  if (!ready) return <SignInPrompt what="appointments" />;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Schedule"
        subtitle="Your calendar and bookings"
        actions={isManager ? <Button variant="primary" icon={<Plus />} onClick={() => openNew()}>Book job</Button> : undefined}
      />

      {/* At a glance — always scoped to the view (day / week / month / list) */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard icon={CalendarCheck} tone="blue" label={scope.labels.jobs} value={String(scopeStats.jobs)} />
        <StatCard icon={Hourglass} tone="purple" label={scope.labels.booked} value={fmtHours(scopeStats.bookedH)} />
        <StatCard icon={scope.fourth === "completed" ? CalendarCheck : Clock} tone="green" label={scope.labels.fourth}
          value={scope.fourth === "completed" ? String(scopeStats.completed) : (scopeStats.availH <= 0 ? "Full" : fmtHours(scopeStats.availH))} />
        <StatCard icon={DollarSign} tone="orange" label={scope.labels.revenue} value={money(scopeStats.revenue)} />
      </div>

      {/* Controls — wrap on mobile */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-panel2 p-1 text-[12.5px] font-semibold">
          {(["day", "week", "month", "list"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={cn("rounded-md px-2.5 py-1.5 capitalize transition-colors", view === v ? "bg-panel text-ink shadow-sm" : "text-ink3")}>
              {v}
            </button>
          ))}
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-1">
            <IconBtn label="Previous" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></IconBtn>
            <button onClick={() => setCursor(new Date())} className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] font-semibold text-ink2 hover:border-brand-500">Today</button>
            <IconBtn label="Next" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></IconBtn>
          </div>
        )}
        <span className="text-[14px] font-bold tracking-tight">{title}</span>
      </div>

      {loading ? <PageSkeleton variant="calendar" header={false} /> : (
        <>
          {view === "month" && <MonthView cursor={cursor} byDay={byDay} onDay={(d) => { setCursor(d); setView("day"); }} onPick={setDetail} />}
          {view === "week" && <WeekView cursor={cursor} byDay={byDay} onPick={setDetail} onEdit={isManager ? openEdit : undefined} onDuplicate={isManager ? openDuplicate : undefined} onAdd={isManager ? openNew : undefined} custById={custById} byId={byId} />}
          {view === "day" && <DayView cursor={cursor} byDay={byDay} onPick={setDetail} onAdd={isManager ? openNew : undefined} byId={byId} />}
          {view === "list" && (
            appointments.length === 0 ? (
              <EmptyState art="garage"
                title={isManager ? "No appointments yet" : "No jobs assigned to you"}
                body={isManager ? "Book your first job — pick a customer, their vehicle, and a service." : "When an owner or admin assigns you a job, it'll show up here."}
                action={isManager ? <Button variant="primary" icon={<Plus />} onClick={() => openNew()}>Book job</Button> : undefined} />
            ) : <ListView appointments={appointments} byId={byId} onPick={setDetail} />
          )}
        </>
      )}

      {/* Detail */}
      <Modal open={Boolean(live)} onClose={() => setDetail(null)}
        title={live ? `${live.customer?.name ?? "Job"} · ${new Date(live.scheduled_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
        footer={<Button onClick={() => setDetail(null)}>Close</Button>}>
        {live && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusStyle[live.status])}>{APPOINTMENT_STATUS_LABEL[live.status]}</span>
              <span className="flex items-center gap-1.5 text-ink2"><Clock className="h-3.5 w-3.5 text-ink3" />{time(live.scheduled_at)} · {live.duration_min} min</span>
              <span className="ml-auto text-[15px] font-bold tnum">{money(live.price)}</span>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] text-ink2">
              <span className="flex items-center gap-2"><Wrench className="h-3.5 w-3.5 text-ink3" />{live.service?.name ?? "No service set"}</span>
              <span className="flex items-center gap-2"><Car className="h-3.5 w-3.5 text-ink3" />{live.vehicle ? vehicleLabel(live.vehicle) : "No vehicle set"}</span>
              <span className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-ink3" />{live.assigned_to ? byId.get(live.assigned_to)?.name ?? "Assigned" : "Unassigned"}</span>
            </div>
            {live.notes && (
              <div className="flex gap-2 rounded-lg bg-panel2 px-3 py-2 text-[13px] text-ink2">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-none text-ink3" />
                <span className="whitespace-pre-wrap">{live.notes}</span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <select className="input" value={live.status} onChange={(e) => setStatus(live.id, e.target.value as AppointmentStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
              {canAssign && (
                <Field label="Assignee">
                  <select className="input" value={live.assigned_to ?? ""} onChange={(e) => assign(live.id, e.target.value || null).catch((x) => toast.error((x as Error).message))}>
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <RemindersBlock appointment={live} api={reminders} />

            <div className="flex gap-2 border-t border-line pt-3">
              {isManager && <Button onClick={() => openEdit(live)}>Edit job</Button>}
              {isManager && (
                <IconBtn label="Delete" danger onClick={async () => { if (await confirm({ title: "Delete this job?", body: "The appointment is permanently removed from your schedule.", confirmLabel: "Delete job", tone: "danger" })) { try { await remove(live.id); setDetail(null); toast.success("Job deleted"); } catch (e) { toast.error((e as Error).message); } } }}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create / edit */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} size="lg" title={editing ? "Edit job" : "Book job"}
        footer={<>
          {bookStep === 0
            ? <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            : <Button onClick={backBook} disabled={busy}>Back</Button>}
          {bookStep < BOOK_STEPS.length - 1
            ? <Button variant="primary" onClick={nextBook} disabled={!bookStepValid[bookStep]}>Continue</Button>
            : <Button variant="primary" onClick={save} disabled={busy || !customerId || !whenValid}
                icon={busy ? <Loader2 className="animate-spin" /> : undefined}>
                {busy ? (editing ? "Saving…" : "Booking…") : editing ? "Save changes" : "Book job"}
              </Button>}
        </>}>
        <div className="flex flex-col gap-4">
          {/* Progress — ● ━ ● ━ ○ ━ ○ + "Step N of 4" */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {BOOK_STEPS.map((_, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 flex-none rounded-full transition-colors", i <= bookStep ? "bg-brand-500" : "bg-line2")} />
                  {i < BOOK_STEPS.length - 1 && <span className={cn("h-px w-4 flex-none transition-colors", i < bookStep ? "bg-brand-500/50" : "bg-line")} />}
                </div>
              ))}
            </div>
            <span className="text-[11.5px] font-semibold text-ink3">Step {bookStep + 1} of {BOOK_STEPS.length}</span>
          </div>

          {/* Sliding step content — min-height keeps the modal from jumping */}
          <div className="min-h-[248px]">
            <motion.div key={bookStep} custom={bookDir} variants={stepSlide} initial="enter" animate="center"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-4">

          {bookStep === 0 && (<>
          {/* Customer — the anchor: required, searchable */}
          <LabeledField label="Customer" required hint={customerId ? undefined : "Required"}>
            <Combobox
              ariaLabel="Customer"
              value={customerId}
              onChange={(id) => { setCustomerId(id); setVehicleId(""); }}
              options={customerOptions}
              searchable clearable
              placeholder="Search customers…"
              searchPlaceholder="Search by name or phone…"
              emptyLabel="No customers yet"
              leading={<UserRound className="h-4 w-4" />}
              invalid={Boolean(error) && !customerId}
              renderOption={(o) => {
                const c = custById.get(o.value);
                return (
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-bold text-brand-500">{initials(o.label)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{o.label}</span>
                      {c?.phone && <span className="block truncate text-[11.5px] text-ink3">{c.phone}</span>}
                    </span>
                  </span>
                );
              }}
            />
          </LabeledField>
          {customers.length === 0 && (
            <div className="-mt-1.5 text-[12.5px] text-warning">Add a customer first on the Customers page.</div>
          )}
          </>)}

          {bookStep === 1 && (<>
          {/* Job details — service drives the job; vehicle is the customer's */}
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label="Service" hint="Sets duration & price">
              <Combobox
                ariaLabel="Service"
                value={serviceId}
                onChange={pickService}
                options={serviceOptions}
                searchable={services.length > 6}
                clearable
                placeholder="Choose a service…"
                emptyLabel="No services yet"
                renderValue={(o) => {
                  const s = svcById.get(o.value); if (!s) return o.label;
                  const Icon = serviceIcon(s.name); const t = SVC_TONE[serviceTone(s.name)];
                  return <span className="flex items-center gap-2"><Icon className={cn("h-4 w-4 flex-none", t.icon)} /><span className="truncate">{s.name}</span></span>;
                }}
                renderOption={(o) => {
                  const s = svcById.get(o.value); if (!s) return o.label;
                  const Icon = serviceIcon(s.name); const t = SVC_TONE[serviceTone(s.name)];
                  return (
                    <span className="flex items-center gap-2.5">
                      <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-lg", t.bg, t.icon)}><Icon className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{s.name}</span>
                        <span className="block text-[11.5px] text-ink3">{s.duration_min} min</span>
                      </span>
                      <span className="flex-none text-[13px] font-semibold tnum text-ink">{money(s.price)}</span>
                    </span>
                  );
                }}
              />
            </LabeledField>
            <LabeledField label="Vehicle" hint={customerId && vehicles.length === 0 ? "None on file" : undefined}>
              <Combobox
                ariaLabel="Vehicle"
                value={vehicleId}
                onChange={setVehicleId}
                options={vehicleOptions}
                clearable
                disabled={!customerId}
                placeholder={customerId ? "Select vehicle…" : "Pick customer first"}
                emptyLabel="No vehicles for this customer"
                leading={<Car className="h-4 w-4" />}
                renderOption={(o) => {
                  const v = vehById.get(o.value);
                  return (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{o.label}</span>
                      {v && (v.color || v.license_plate) && (
                        <span className="block truncate text-[11.5px] text-ink3">{[v.color, v.license_plate].filter(Boolean).join(" · ")}</span>
                      )}
                    </span>
                  );
                }}
              />
            </LabeledField>
          </div>
          </>)}

          {bookStep === 2 && (<>
          {/* Schedule — date + time, with a scannable summary */}
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledField label="Date">
                <input type="date" className="input" value={datePart}
                  onChange={(e) => setWhen(`${e.target.value || datePart}T${timePart || "09:00"}`)} />
              </LabeledField>
              <LabeledField label="Time">
                <input type="time" className="input" value={timePart}
                  onChange={(e) => setWhen(`${datePart}T${e.target.value || timePart}`)} />
              </LabeledField>
            </div>
            {whenValid && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500/[0.07] px-2.5 py-1.5 text-[12px] font-semibold text-ink2 ring-1 ring-inset ring-brand-500/15">
                <CalendarDays className="h-3.5 w-3.5 text-brand-500" />
                {new Date(when).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {time(new Date(when).toISOString())}
              </div>
            )}
          </div>

          {/* Duration + price — seeded from the service, always overridable */}
          <div className="rounded-xl border border-line bg-panel2/60 p-3">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">Duration &amp; price</span>
              <span className="ml-auto text-[11.5px] text-ink3">
                {selectedService ? <>From <span className="font-medium text-ink2">{selectedService.name}</span> · editable</> : "Set manually"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-ink3">Duration</span>
                <div className="relative">
                  <input type="number" min={0} step={5} className="input tnum pr-12" value={duration} onChange={(e) => setDuration(e.target.value)} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink3">min</span>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-ink3">Price</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink3">$</span>
                  <input type="number" min={0} step="0.01" className="input tnum pl-7" value={price} placeholder="0.00"
                    onChange={(e) => setPrice(e.target.value)}
                    onBlur={() => { if (price.trim() !== "" && !Number.isNaN(Number(price))) setPrice(Number(price).toFixed(2)); }} />
                </div>
              </label>
            </div>
          </div>
          </>)}

          {bookStep === 3 && (<>
            {/* Review — a clean summary of the booking before submitting */}
            <div className="rounded-xl border border-line bg-panel2/40 p-3.5">
              <div className="flex flex-col gap-2 text-[13px]">
                {([
                  ["Customer", custById.get(customerId)?.name ?? "—"],
                  ["Service", selectedService?.name ?? "No service"],
                  ["Vehicle", selectedVehicle ? vehicleLabel(selectedVehicle) : "None"],
                  ["Date", whenValid ? new Date(when).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—"],
                  ["Time", whenValid ? time(new Date(when).toISOString()) : "—"],
                  ["Duration", `${Number(duration) || 0} min`],
                  ["Price", price ? money(Number(price)) : "—"],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="flex items-baseline justify-between gap-3">
                    <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.06em] text-ink3">{l}</span>
                    <span className="min-w-0 truncate text-right text-[13px] font-medium text-ink">{v}</span>
                  </div>
                ))}
              </div>
            </div>

          {conflict && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-warning ring-1 ring-inset ring-warning/25">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>
                Overlaps <b>{conflict.appt.customer?.name ?? "another job"}</b>
                {conflict.appt.service?.name ? ` (${conflict.appt.service.name})` : ""} · {time(conflict.appt.scheduled_at)}–{time(new Date(conflict.endsAt).toISOString())}. You can still book if you run parallel bays.
              </span>
            </div>
          )}

          <LabeledField label="Notes" hint="Optional">
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, paint condition, customer requests…" />
          </LabeledField>
          </>)}

            </motion.div>
          </div>

          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}

// --------------------------------------------------------------------------- views

function Chip({ a, onPick }: { a: Appointment; onPick: (a: Appointment) => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onPick(a); }}
      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10.5px] hover:bg-brand-500/10">
      <span className={cn("h-1.5 w-1.5 flex-none rounded-full", statusDot[a.status])} />
      <span className="truncate text-ink2">{time(a.scheduled_at)} {a.customer?.name ?? ""}</span>
    </button>
  );
}

function MonthView({ cursor, byDay, onDay, onPick }: {
  cursor: Date; byDay: Map<string, Appointment[]>; onDay: (d: Date) => void; onPick: (a: Appointment) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * DAY));
  const today = new Date();
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-panel2 text-center text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">
            {/* letter on phones, short name from sm up — CSS so it reacts to resize */}
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(key(d)) ?? [];
          const outside = d.getMonth() !== cursor.getMonth();
          // A div (not a button) so the per-appointment Chip buttons nest legally.
          return (
            <div key={key(d)} role="button" tabIndex={0} onClick={() => onDay(d)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDay(d); } }}
              className={cn("min-h-[74px] cursor-pointer border-b border-r border-line2 p-1 text-left align-top outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40 sm:min-h-[104px]",
                outside && "bg-panel2/40", "hover:bg-brand-500/[0.04]")}>
              <div className={cn("mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                sameDay(d, today) ? "bg-brand-500 text-white" : outside ? "text-ink3" : "text-ink")}>
                {d.getDate()}
              </div>
              {/* chips on desktop, dots on mobile */}
              <div className="hidden flex-col gap-0.5 sm:flex">
                {list.slice(0, 3).map((a) => <Chip key={a.id} a={a} onPick={onPick} />)}
                {list.length > 3 && <span className="px-1 text-[10px] text-ink3">+{list.length - 3} more</span>}
              </div>
              <div className="flex flex-wrap gap-0.5 sm:hidden">
                {list.slice(0, 4).map((a) => <span key={a.id} className={cn("h-1.5 w-1.5 rounded-full", statusDot[a.status])} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type CustLite = { name: string; phone?: string | null; address?: string | null };

function WeekView({ cursor, byDay, onPick, onEdit, onDuplicate, onAdd, custById, byId }: {
  cursor: Date; byDay: Map<string, Appointment[]>;
  onPick: (a: Appointment) => void; onEdit?: (a: Appointment) => void; onDuplicate?: (a: Appointment) => void;
  onAdd?: (d: Date) => void; custById: Map<string, CustLite>; byId: Map<string, { name: string }>;
}) {
  const s = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => new Date(s.getTime() + i * DAY));
  const now = new Date();
  return (
    <div className="grid overflow-hidden rounded-xl border border-line max-sm:divide-y max-sm:divide-line sm:grid-cols-7 sm:divide-x sm:divide-line">
      {days.map((d) => {
        const list = byDay.get(key(d)) ?? [];
        const isToday = sameDay(d, now);
        return (
          <div key={key(d)}
            onClick={onAdd ? () => onAdd(new Date(d)) : undefined}
            className={cn("flex min-h-[168px] flex-col p-2.5 sm:min-h-[200px]", isToday && "bg-brand-500/[0.04]", onAdd && "cursor-pointer")}>
            {/* Day header — weekday, date, count, and a restrained Today marker */}
            <div className="mb-2 flex items-start justify-between gap-1 px-0.5">
              <div className="min-w-0">
                <div className={cn("text-[10.5px] font-semibold uppercase tracking-wide", isToday ? "text-brand-500" : "text-ink3")}>
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={cn("text-[18px] font-bold leading-none tracking-tight", isToday && "text-brand-500")}>{d.getDate()}</span>
                  {list.length > 0 && <span className="text-[11px] text-ink3">{list.length} job{list.length === 1 ? "" : "s"}</span>}
                </div>
              </div>
              {isToday && <span className="flex-none rounded-full bg-brand-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-500">Today</span>}
            </div>

            {list.length === 0 ? (
              <button
                onClick={onAdd ? (e) => { e.stopPropagation(); onAdd(new Date(d)); } : undefined}
                disabled={!onAdd}
                className="mt-0.5 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-4 text-center text-[11px] text-ink3 transition-colors hover:text-brand-500 disabled:cursor-default disabled:hover:text-ink3"
              >
                <span>No appointments</span>
                {onAdd && <span className="font-semibold text-brand-500">Book one</span>}
              </button>
            ) : (
              <div className="flex flex-col gap-1.5">
                {list.map((a) => (
                  <WeekCard key={a.id} a={a} onPick={onPick} onEdit={onEdit} onDuplicate={onDuplicate} cust={custById.get(a.customer_id)}
                    assignee={a.assigned_to ? byId.get(a.assigned_to)?.name ?? "Assigned" : null} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The ONE universal appointment card. Identical for every day and status:
 *  a neutral card whose only accent is a status-coloured left bar. Hierarchy is
 *  Time → Customer → Service → Vehicle → Assignee → Status (always shown). */
function WeekCard({ a, onPick, onEdit, onDuplicate, cust, assignee }: {
  a: Appointment; onPick: (a: Appointment) => void; onEdit?: (a: Appointment) => void;
  onDuplicate?: (a: Appointment) => void; cust?: CustLite; assignee?: string | null;
}) {
  const Svc = serviceIcon(a.service?.name);
  const svcIcon = SVC_TONE[serviceTone(a.service?.name)].icon; // subtle service cue via icon colour only
  const open = () => onPick(a);
  return (
    <div
      role="button" tabIndex={0}
      onClick={(e) => { e.stopPropagation(); open(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); open(); } }}
      className={cn("group/card relative cursor-pointer rounded-lg border border-line border-l-[3px] bg-panel p-2 outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card focus-visible:ring-2 focus-visible:ring-brand-500/30", statusBar[a.status])}
    >
      {/* Time — strong + always scannable */}
      <div className="text-[11.5px] font-bold tabular-nums tracking-tight text-ink">
        {time(a.scheduled_at)} – {endTime(a.scheduled_at, a.duration_min)}
      </div>
      {/* Customer */}
      <div className="mt-0.5 truncate text-[12.5px] font-bold tracking-tight text-ink">{a.customer?.name ?? "Customer"}</div>
      {/* Service */}
      {a.service?.name && (
        <div className="mt-1">
          <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-ink/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-ink2">
            <Svc className={cn("h-3 w-3 flex-none", svcIcon)} />
            <span className="min-w-0 truncate">{a.service.name}</span>
          </span>
        </div>
      )}
      {/* Vehicle */}
      {a.vehicle && <div className="mt-1 truncate text-[10.5px] text-ink3">{vehicleLabel(a.vehicle)}</div>}
      {/* Assignee + status — status is always present */}
      <div className="mt-1.5 flex items-center gap-1.5">
        {assignee ? (
          <span className="flex min-w-0 items-center gap-1 text-[10.5px] text-ink3">
            <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-brand-500/12 text-[8px] font-bold text-brand-500">{initials(assignee)}</span>
            <span className="truncate">{assignee}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10.5px] text-ink3/70"><UserRound className="h-3 w-3 flex-none" />Unassigned</span>
        )}
        <span className={cn("ml-auto flex-none whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold", statusStyle[a.status])}>
          {APPOINTMENT_STATUS_LABEL[a.status]}
        </span>
      </div>

      {/* Quick actions — hidden until hover */}
      <div className="absolute right-1 top-1 hidden max-w-[calc(100%-8px)] flex-wrap items-center justify-end gap-0.5 rounded-md bg-panel/95 p-0.5 shadow-card ring-1 ring-inset ring-line group-hover/card:flex">
        <MiniAction icon={Eye} label="View" onClick={open} />
        {onEdit && <MiniAction icon={Pencil} label="Edit" onClick={() => onEdit(a)} />}
        {cust?.phone && <MiniAction icon={MessageSquare} label="Message customer" href={`sms:${cust.phone}`} />}
        {cust?.address && <MiniAction icon={Navigation} label="Directions" href={`https://maps.google.com/?q=${encodeURIComponent(cust.address)}`} external />}
        {onDuplicate && <MiniAction icon={Copy} label="Duplicate" onClick={() => onDuplicate(a)} />}
      </div>
    </div>
  );
}

function MiniAction({ icon: Icon, label, onClick, href, external }: {
  icon: typeof Eye; label: string; onClick?: () => void; href?: string; external?: boolean;
}) {
  const cls = "flex h-6 w-6 flex-none items-center justify-center rounded text-ink3 transition-colors hover:bg-line2 hover:text-ink";
  if (href) return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} aria-label={label} title={label} onClick={(e) => e.stopPropagation()} className={cls}><Icon className="h-3.5 w-3.5" /></a>;
  return <button type="button" aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onClick?.(); }} className={cls}><Icon className="h-3.5 w-3.5" /></button>;
}

function StatCard({ icon: Icon, tone, label, value }: { icon: typeof Clock; tone: SvcTone; label: string; value: string }) {
  const t = SVC_TONE[tone];
  return (
    <div className="surface rounded-xl p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-lg", t.bg, t.icon)}><Icon className="h-3.5 w-3.5" /></span>
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">{label}</span>
      </div>
      <div className="mt-2 truncate font-display text-[19px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
    </div>
  );
}

function DayView({ cursor, byDay, onPick, onAdd, byId }: {
  cursor: Date; byDay: Map<string, Appointment[]>; onPick: (a: Appointment) => void; onAdd?: (d: Date) => void;
  byId: Map<string, { name: string }>;
}) {
  const list = byDay.get(key(cursor)) ?? [];
  if (list.length === 0) {
    return (
      <EmptyState art="garage" title="Nothing booked" body="This day is clear — schedule a detail and it'll show up right here."
        action={onAdd ? <Button variant="primary" icon={<Plus />} onClick={() => onAdd(new Date(cursor))}>Book job</Button> : undefined} />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {list.map((a) => {
        const Svc = serviceIcon(a.service?.name);
        const svcIcon = SVC_TONE[serviceTone(a.service?.name)].icon;
        const assignee = a.assigned_to ? byId.get(a.assigned_to)?.name ?? "Assigned" : null;
        return (
          <button key={a.id} onClick={() => onPick(a)}
            className={cn("group flex w-full items-center gap-3 rounded-xl border border-line border-l-[3px] bg-panel px-3 py-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card", statusBar[a.status])}>
            <div className="flex w-[74px] flex-none flex-col">
              <span className="text-[14px] font-bold leading-none tnum">{time(a.scheduled_at)}</span>
              <span className="mt-1 text-[10.5px] tnum text-ink3">{endTime(a.scheduled_at, a.duration_min)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold">{a.customer?.name ?? "Customer"}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="inline-flex flex-none items-center gap-1 rounded-full bg-ink/[0.05] px-2 py-0.5 text-[11.5px] font-medium text-ink2">
                  <Svc className={cn("h-3 w-3 flex-none", svcIcon)} />{a.service?.name ?? "Service"}
                </span>
                {a.vehicle && <span className="truncate text-ink3">{vehicleLabel(a.vehicle)}</span>}
                {assignee && (
                  <span className="flex items-center gap-1 text-ink3">
                    <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-brand-500/12 text-[8px] font-bold text-brand-500">{initials(assignee)}</span>
                    {assignee}
                  </span>
                )}
              </div>
            </div>
            <span className="hidden tnum text-[13px] font-semibold sm:block">{money(a.price)}</span>
            <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", statusStyle[a.status])}>
              {APPOINTMENT_STATUS_LABEL[a.status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ListView({ appointments, byId, onPick }: {
  appointments: Appointment[]; byId: Map<string, { name: string }>; onPick: (a: Appointment) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-panel2 text-left text-[11px] uppercase tracking-[0.07em] text-ink3">
            <Th>When</Th><Th>Customer</Th><Th>Service</Th><Th>Assignee</Th><Th>Price</Th><Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id} onClick={() => onPick(a)} className="cursor-pointer border-b border-line2 last:border-b-0 hover:bg-brand-500/[0.06]">
              <Td className="whitespace-nowrap font-medium">
                {new Date(a.scheduled_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </Td>
              <Td>{a.customer?.name ?? "—"}</Td>
              <Td className="text-ink2">{a.service?.name ?? "—"}</Td>
              <Td className="text-ink2">{a.assigned_to ? byId.get(a.assigned_to)?.name ?? "Assigned" : "—"}</Td>
              <Td className="tnum">{money(a.price)}</Td>
              <Td><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusStyle[a.status])}>{APPOINTMENT_STATUS_LABEL[a.status]}</span></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------------------- reminders

function RemindersBlock({ appointment, api }: { appointment: Appointment; api: ReturnType<typeof useReminders> }) {
  const mine = api.forAppointment(appointment.id);
  const delivery = useDelivery();
  const [busy, setBusy] = useState(false);

  const add = async (hoursBefore: number) => {
    setBusy(true);
    try {
      const at = new Date(new Date(appointment.scheduled_at).getTime() - hoursBefore * 3600_000);
      await api.create(appointment.id, at.toISOString());
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  /** Send it through the API now (server renders + picks the channel). */
  const sendNow = async (id: string) => {
    setBusy(true);
    try {
      const r = await sendReminderNow(id);
      await api.reload();
      if (!delivery.sms.live && r.channel === "sms") {
        toast.info(`Reminder logged via ${r.provider}. Live texting isn't switched on yet, so it wasn't sent to ${r.to}.`);
      }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center gap-2">
        <Bell className="h-3.5 w-3.5 text-brand-500" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.07em] text-ink3">Customer reminders</span>
      </div>
      {mine.length === 0 ? (
        <p className="mb-2 text-[12px] text-ink3">No reminder set for this job.</p>
      ) : (
        <div className="mb-2 flex flex-col gap-1.5">
          {mine.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-[12.5px]">
              <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                r.status === "sent" ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                {r.status === "sent" ? "Sent" : "Pending"}
              </span>
              <span className="text-ink2">
                {new Date(r.remind_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {r.status === "pending" && delivery.reachable && (
                  <IconBtn label={delivery.sms.live ? "Send now" : "Send now (texting not switched on)"} onClick={() => sendNow(r.id)}>
                    <Send className="h-3.5 w-3.5" />
                  </IconBtn>
                )}
                {r.status === "pending" && (
                  <IconBtn
                    label="Send now"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await api.sendNow(r.id);
                        toast.success(`Reminder sent to ${res.to} via ${res.provider}`);
                      } catch (e) {
                        // API unreachable? offer to just record it by hand.
                        const msg = (e as Error).message;
                        if (/Connection error/i.test(msg) && await confirm({ title: "Couldn't reach the messaging service", body: `${msg} Mark this reminder as sent anyway?`, confirmLabel: "Mark as sent" })) {
                          await api.markSent(r.id);
                          toast.success("Reminder marked as sent");
                        } else toast.error(msg);
                      } finally { setBusy(false); }
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </IconBtn>
                )}
                <IconBtn label="Remove reminder" danger onClick={() => api.remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {[24, 2].map((h) => (
          <button key={h} disabled={busy} onClick={() => add(h)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink2 hover:border-brand-500 disabled:opacity-50">
            <BellPlus className="h-3 w-3" /> {h}h before
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink3">
        {delivery.sms.live
          ? "Sends as a text to the customer's phone."
          : delivery.reachable
            ? "Texting isn't switched on yet — “Send now” renders it through the API and logs it. Add Twilio keys to send for real."
            : "Reminders show up here when due so you can send and mark them off."}
      </p>
    </div>
  );
}

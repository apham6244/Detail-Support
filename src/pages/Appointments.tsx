import { useMemo, useState } from "react";
import {
  Plus, Trash2, UserRound, ChevronLeft, ChevronRight,
  Clock, Bell, BellPlus, Car, Wrench, StickyNote, Send, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
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
          {view === "week" && <WeekView cursor={cursor} byDay={byDay} onPick={setDetail} onAdd={isManager ? openNew : undefined} />}
          {view === "day" && <DayView cursor={cursor} byDay={byDay} onPick={setDetail} onAdd={isManager ? openNew : undefined} />}
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
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit job" : "Book job"}
        footer={<><Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !customerId}>{busy ? "Saving…" : editing ? "Save changes" : "Book"}</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Customer">
            <select className="input" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }}>
              <option value="">Select a customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {customers.length === 0 && <div className="text-[12.5px] text-warning">Add a customer first (Customers page).</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle">
              <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} disabled={!customerId}>
                <option value="">{customerId ? "Optional…" : "Pick customer first"}</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}
              </select>
            </Field>
            <Field label="Service">
              <select className="input" value={serviceId} onChange={(e) => {
                setServiceId(e.target.value);
                const s = services.find((x) => x.id === e.target.value);
                if (s) { if (!price) setPrice(String(s.price)); setDuration(String(s.duration_min || 60)); }
              }}>
                <option value="">Optional…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date & time">
              <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
            <Field label="Minutes">
              <input type="number" className="input tnum" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Field label="Price ($)">
              <input type="number" min={0} step="0.01" className="input tnum" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </Field>
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
          <Field label="Notes">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, paint condition, customer requests…" />
          </Field>
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
          return (
            <button key={key(d)} onClick={() => onDay(d)}
              className={cn("min-h-[74px] border-b border-r border-line2 p-1 text-left align-top last:border-r-0 sm:min-h-[104px]",
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, byDay, onPick, onAdd }: {
  cursor: Date; byDay: Map<string, Appointment[]>; onPick: (a: Appointment) => void; onAdd?: (d: Date) => void;
}) {
  const s = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => new Date(s.getTime() + i * DAY));
  const today = new Date();
  return (
    <div className="grid overflow-hidden rounded-xl border border-line max-sm:divide-y max-sm:divide-line sm:grid-cols-7 sm:divide-x sm:divide-line">
      {days.map((d) => {
        const list = byDay.get(key(d)) ?? [];
        const isToday = sameDay(d, today);
        return (
          <div key={key(d)} className={cn("p-2.5", isToday && "bg-brand-500/[0.04]")}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] font-semibold uppercase text-ink3">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                <div className={cn("text-[15px] font-bold", isToday && "text-brand-500")}>{d.getDate()}</div>
              </div>
              {onAdd && (
                <button onClick={() => onAdd(new Date(d))} aria-label="Book on this day"
                  className="flex h-6 w-6 items-center justify-center rounded text-ink3 hover:bg-line2 hover:text-brand-500">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {list.length === 0 ? <span className="px-1 py-2 text-[11px] text-ink3">—</span> :
                list.map((a) => (
                  <button key={a.id} onClick={() => onPick(a)}
                    className="rounded-lg bg-panel2 p-1.5 text-left transition-colors hover:bg-brand-500/10">
                    <div className="flex items-center gap-1">
                      <span className={cn("h-1.5 w-1.5 flex-none rounded-full", statusDot[a.status])} />
                      <span className="truncate text-[11px] font-semibold">{time(a.scheduled_at)}</span>
                    </div>
                    <div className="truncate text-[11.5px] text-ink2">{a.customer?.name ?? "Customer"}</div>
                  </button>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ cursor, byDay, onPick, onAdd }: {
  cursor: Date; byDay: Map<string, Appointment[]>; onPick: (a: Appointment) => void; onAdd?: (d: Date) => void;
}) {
  const list = byDay.get(key(cursor)) ?? [];
  if (list.length === 0) {
    return (
      <EmptyState art="garage" title="Nothing booked" body="This day is clear — schedule a detail and it'll show up right here."
        action={onAdd ? <Button variant="primary" icon={<Plus />} onClick={() => onAdd(new Date(cursor))}>Book job</Button> : undefined} />
    );
  }
  return (
    <div className="divide-y divide-line2 border-y border-line">
      {list.map((a) => (
        <button key={a.id} onClick={() => onPick(a)} className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-panel2/60">
          <div className="w-[68px] flex-none text-[13px] font-semibold">{time(a.scheduled_at)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold">{a.customer?.name ?? "Customer"}</div>
            <div className="truncate text-xs text-ink3">
              {a.service?.name ?? "Service"}{a.vehicle ? ` · ${vehicleLabel(a.vehicle)}` : ""}
            </div>
          </div>
          <span className="hidden tnum text-[13px] font-semibold sm:block">{money(a.price)}</span>
          <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", statusStyle[a.status])}>
            {APPOINTMENT_STATUS_LABEL[a.status]}
          </span>
        </button>
      ))}
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

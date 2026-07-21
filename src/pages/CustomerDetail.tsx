import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, MapPin, Car, Trash2, Pencil, Plus,
  DollarSign, Repeat, CalendarCheck, X as XIcon, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { IconBtn, Loading, SignInPrompt, money } from "@/components/ui/data";
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
  vehicleLabel, APPOINTMENT_STATUS_LABEL, type AppointmentStatus, type JobPhoto,
} from "@/lib/models";
import { cn } from "@/lib/cn";

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

export default function CustomerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { customers, loading, ready, update, remove } = useCustomers();
  const { appointments } = useAppointments();
  const { invoices } = useInvoices();
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

  const stats = useMemo(() => {
    const mine = invoices.filter((i) => i.customer_id === id);
    const spent = mine.reduce(
      (s, i) => s + (i.status === "paid" ? i.total : i.status === "deposit_paid" ? i.deposit_amount : 0),
      0
    );
    const done = history.filter((a) => a.status === "completed");
    return {
      spent,
      visits: done.length,
      last: done[0]?.scheduled_at ?? null,
    };
  }, [invoices, history, id]);

  if (!ready) return <SignInPrompt what="customers" />;
  if (loading) return <Loading />;
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

  return (
    <div className="animate-fade-up">
      <BackLink />

      {/* Header */}
      <div className="mb-5 mt-3 flex flex-wrap items-start gap-4">
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-brand-500/10 text-[18px] font-bold uppercase text-brand-500">
          {customer.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight">{customer.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink2">
            {customer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-ink3" />{customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-ink3" />{customer.email}</span>}
            {customer.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-ink3" />{customer.address}</span>}
            {!customer.phone && !customer.email && !customer.address && (
              <span className="text-ink3">No contact details yet</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button icon={<Pencil />} onClick={openEdit}>Edit</Button>
          {canManage && (
            <>
              <Button variant="primary" icon={<Plus />} onClick={() => navigate("/appointments")}>Book job</Button>
              <IconBtn
                label="Delete customer"
                danger
                onClick={async () => {
                  if (!window.confirm(`Delete ${customer.name}? Their vehicles, jobs and photos go too.`)) return;
                  await remove(customer.id);
                  navigate("/customers");
                }}
              >
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </>
          )}
        </div>
      </div>

      {/* Stats — borderless band */}
      <div className="grid grid-cols-3 gap-x-4 border-y border-line py-6 sm:gap-x-0 sm:divide-x sm:divide-line">
        <Stat icon={DollarSign} accent="success" label="Total spent" value={money(stats.spent)} sub="Collected to date" />
        <Stat icon={Repeat} accent="brand" label="Visits" value={String(stats.visits)} sub="Completed jobs" />
        <Stat icon={CalendarCheck} accent="violet" label="Last visit" value={stats.last ? fmtDate(stats.last) : "—"} sub={stats.last ? "Most recent job" : "No visits yet"} />
      </div>

      {customer.notes && (
        <Panel title="Notes" className="mt-8">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink2">{customer.notes}</p>
        </Panel>
      )}

      <div className="mt-8 grid gap-x-12 gap-y-9 border-t border-line pt-8 lg:grid-cols-[1fr_1.3fr]">
        <VehiclesCard customerId={customer.id} canManage={canManage} />

        <Panel title="Service history" subtitle={`${history.length} job${history.length === 1 ? "" : "s"}`}>
          {!ent.hasFeature("customer_history") ? (
            <FeatureLocked
              feature="customer_history"
              title="Service history"
              description="See every past job, what was done, and what this customer has spent."
              compact
            />
          ) : history.length === 0 ? (
            <Empty art="garage" title="No jobs yet" body="Book this customer in and their history builds here." />
          ) : (
            <div className="divide-y divide-line2">
              {history.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{a.service?.name ?? "Service"}</div>
                    <div className="truncate text-xs text-ink3">
                      {fmtDateTime(a.scheduled_at)}
                      {a.vehicle ? ` · ${vehicleLabel(a.vehicle)}` : ""}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[13px] font-semibold tnum">{money(a.price)}</span>
                  <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", statusStyle[a.status])}>
                    {APPOINTMENT_STATUS_LABEL[a.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Photos */}
      <div className="mt-8 border-t border-line pt-8">
        <PhotosCard customerId={customer.id} gated={!ent.hasFeature("customer_history")} />
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
          <div className="grid grid-cols-2 gap-4">
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
          <Field label="Notes">
            <textarea className="input" rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {err && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{err}</div>}
        </div>
      </Modal>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/customers" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink3 hover:text-brand-500">
      <ArrowLeft className="h-4 w-4" /> All customers
    </Link>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }: {
  icon: typeof DollarSign; label: string; value: string; sub: string;
  accent: "brand" | "success" | "violet";
}) {
  const tint = { brand: "text-brand-500", success: "text-success", violet: "text-violet" }[accent];
  return (
    <div className="sm:px-6 sm:first:pl-0 sm:last:pr-0">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-4 w-4", tint)} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">{label}</span>
      </div>
      <div className="mt-2 font-display text-[24px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
      <div className="mt-2 truncate text-xs text-ink3">{sub}</div>
    </div>
  );
}

/** A borderless section: heading (+ optional subtitle / right-aligned action), then content. */
function Panel({ title, subtitle, action, className, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <span className="text-[12px] font-medium text-ink3">· {subtitle}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Empty({ art, title, body }: { art: EmptyArtVariant; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <EmptyArt variant={art} className="w-[150px]" />
      <div className="text-[13.5px] font-semibold">{title}</div>
      <div className="max-w-xs text-xs text-ink3">{body}</div>
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
        <Empty art="car" title="No vehicles yet" body="Add the cars you look after for this customer." />
      ) : (
        <div className="divide-y divide-line2">
          {vehicles.map((veh) => (
            <div key={veh.id} className="flex items-start gap-3 py-3">
              <Car className="mt-0.5 h-4 w-4 flex-none text-ink3" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{vehicleLabel(veh)}</div>
                <div className="text-xs text-ink3">
                  {[veh.color, veh.license_plate, veh.vin ? `VIN ${veh.vin}` : null].filter(Boolean).join(" · ") || "No details"}
                </div>
                {veh.notes && <div className="mt-1 text-xs text-ink2">{veh.notes}</div>}
              </div>
              {canManage && (
                <IconBtn onClick={() => remove(veh.id)} label="Remove vehicle" danger>
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
          <Loading />
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
                  onClick={() => window.confirm("Delete this photo?") && remove(p)}
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

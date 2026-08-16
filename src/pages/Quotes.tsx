import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Plus,
  Trash2,
  Send,
  Check,
  X as XIcon,
  ArrowRight,
  Receipt,
  CalendarPlus,
  Pencil,
  UserRound,
  Phone,
  Car,
  Loader2,
  EyeOff,
  ReceiptText,
  SlidersHorizontal,
  CalendarClock,
  StickyNote,
  Lock,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { Th, Td, IconBtn, EmptyState, SignInPrompt, money } from "@/components/ui/data";
import { confirm, toast } from "@/components/ui/feedback";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useQuotes, type QuoteInput } from "@/hooks/useQuotes";
import { useCustomers } from "@/hooks/useCustomers";
import { useServices } from "@/hooks/useServices";
import { useVehicles } from "@/hooks/useVehicles";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useEntitlements } from "@/lib/entitlements";
import { FeatureLocked } from "@/components/UpgradeGate";
import {
  QUOTE_STATUS_LABEL,
  effectiveQuoteStatus,
  vehicleLabel,
  type Quote,
  type QuoteStatus,
  type QuoteLineItem,
} from "@/lib/models";
import { cn } from "@/lib/cn";

/** One-thing-at-a-time quote wizard — same slide pattern as Add Service / Book Job. */
const QUOTE_STEPS = ["Customer", "Line items", "Pricing", "Review"] as const;
const stepSlide = {
  enter: (d: number) => ({ opacity: 0, x: d >= 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
};

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: "text-ink2 bg-line2",
  sent: "text-brand-500 bg-brand-500/10",
  accepted: "text-success bg-success/10",
  declined: "text-danger bg-danger/10",
  expired: "text-warning bg-warning/10",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

type LineRow = { id: string; service_id: string | null; description: string; quantity: number; unit_price: number };
const blankLine = (): LineRow => ({ id: crypto.randomUUID(), service_id: null, description: "", quantity: 1, unit_price: 0 });

/** Up-to-two-letter initials for the selected-customer avatar chip. */
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

function StatusPill({ q }: { q: Quote }) {
  const s = effectiveQuoteStatus(q);
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[s])}>
      {QUOTE_STATUS_LABEL[s]}
    </span>
  );
}

export default function Quotes() {
  const quotesApi = useQuotes();
  const { quotes, loading, ready } = quotesApi;
  const { customers } = useCustomers();
  const { services } = useServices();
  const { ws } = useWorkspace();
  const ent = useEntitlements();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [lines, setLines] = useState<LineRow[]>([blankLine()]);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const { vehicles } = useVehicles(customerId || null);

  const taxLabel = (ws?.settings?.tax_label || "Tax").trim() || "Tax";
  const defaultTaxRate = ws?.settings?.tax_enabled ? ws?.settings?.tax_rate ?? null : null;

  const num = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };
  const todayStr = new Date().toISOString().slice(0, 10);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines]
  );
  const discountAmount = useMemo(() => {
    const v = num(discountValue);
    if (v <= 0) return 0;
    return discountMode === "percent" ? (subtotal * Math.min(v, 100)) / 100 : v;
  }, [discountValue, discountMode, subtotal]);
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxRateNum = Math.max(0, num(taxRate));
  const taxAmount = (taxable * taxRateNum) / 100;
  const total = taxable + taxAmount;

  // Live validation — used for concise inline messages, not one generic error.
  const validLines = lines.filter((l) => l.description.trim() && (Number(l.quantity) || 0) > 0);
  const problems = {
    customer: !customerId,
    lines: validLines.length === 0,
    qty: lines.some((l) => l.description.trim() && (Number(l.quantity) || 0) <= 0),
    price: lines.some((l) => Number(l.unit_price) < 0),
    discount: discountAmount > subtotal + 1e-9,
    expires: Boolean(validUntil) && validUntil < todayStr,
  };
  const hasBlocking = Object.values(problems).some(Boolean);

  const detail = quotes.find((q) => q.id === detailId) ?? null;
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;

  // ---- gates ----
  if (ent.loading) return <PageSkeleton variant="table" kpis={0} />;
  if (!ent.hasFeature("quotes")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Quotes" subtitle="Estimates for your customers" />
        <FeatureLocked
          feature="quotes"
          title="Quotes"
          description="Send professional estimates, then turn accepted quotes into appointments or invoices in one click."
        />
      </div>
    );
  }

  const resetForm = () => {
    setCustomerId("");
    setVehicleId("");
    setLines([blankLine()]);
    setDiscountMode("amount");
    setDiscountValue("");
    setTaxRate(defaultTaxRate != null ? String(defaultTaxRate) : "");
    setValidUntil("");
    setNotes("");
    setInternalNotes("");
    setError(null);
    setTried(false);
    setStep(0);
    setDir(1);
  };

  const openNew = () => {
    resetForm();
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = async (q: Quote) => {
    const ls = await quotesApi.loadLines(q.id);
    const loaded = ls.length
      ? ls.map((l) => ({ id: crypto.randomUUID(), service_id: l.service_id ?? null, description: l.description, quantity: l.quantity, unit_price: l.unit_price }))
      : [blankLine()];
    setEditingId(q.id);
    setCustomerId(q.customer_id);
    setVehicleId(q.vehicle_id ?? "");
    setLines(loaded);
    setDiscountMode("amount");
    setDiscountValue(q.discount ? String(q.discount) : "");
    // Reconstruct a tax rate from the stored tax amount (tax is saved as $).
    const sub = loaded.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
    const base = Math.max(0, sub - (q.discount || 0));
    setTaxRate(q.tax && base > 0 ? String(Math.round((q.tax / base) * 10000) / 100) : "");
    setValidUntil(q.valid_until ? q.valid_until.slice(0, 10) : "");
    setNotes(q.notes ?? "");
    setInternalNotes(q.internal_notes ?? "");
    setError(null);
    setTried(false);
    setStep(0);
    setDir(1);
    setDetailId(null);
    setFormOpen(true);
  };

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickService = (i: number, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return setLine(i, { service_id: null });
    setLine(i, { service_id: svc.id, description: svc.name, unit_price: svc.price });
  };

  const setExpiryDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setValidUntil(d.toISOString().slice(0, 10));
  };

  // Create (draft) or create-and-send. Blocked politely if the form is invalid.
  const submit = async (send: boolean) => {
    setTried(true);
    if (hasBlocking) { setError(null); return; }
    setBusy(true);
    setError(null);
    try {
      const input: QuoteInput = {
        customer_id: customerId,
        vehicle_id: vehicleId || null,
        discount: Math.round(discountAmount * 100) / 100,
        tax: Math.round(taxAmount * 100) / 100,
        notes: notes || null,
        internal_notes: internalNotes || null,
        valid_until: validUntil || null,
        lines: validLines.map((l) => ({
          service_id: l.service_id,
          description: l.description,
          quantity: Number(l.quantity) || 1,
          unit_price: Number(l.unit_price) || 0,
        })),
      };
      if (editingId) {
        await quotesApi.update(editingId, input);
        toast.success("Quote saved");
      } else {
        const q = await quotesApi.create(input);
        if (send) { await quotesApi.setStatus(q.id, "sent"); toast.success("Quote created & sent"); }
        else toast.success("Draft saved");
      }
      setFormOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Wizard: per-step validity + slide navigation (all input is preserved).
  const quoteStepValid = [
    Boolean(customerId),
    !problems.lines && !problems.qty && !problems.price,
    !problems.discount && !problems.expires,
    true,
  ];
  const gotoQuote = (n: number, d: number) => { setDir(d); setStep(Math.max(0, Math.min(QUOTE_STEPS.length - 1, n))); };
  const nextQuote = () => { if (quoteStepValid[step]) gotoQuote(step + 1, 1); };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Quotes"
        subtitle="Estimates for your customers"
        actions={
          ready ? (
            <Button variant="primary" icon={<Plus />} onClick={openNew}>
              New quote
            </Button>
          ) : undefined
        }
      />

      {!ready ? (
        <SignInPrompt what="quotes" />
      ) : loading ? (
        <PageSkeleton variant="table" kpis={0} header={false} />
      ) : quotes.length === 0 ? (
        <EmptyState
          art="receipt"
          title="No quotes yet"
          body="Create an estimate for a customer, send it, and convert it once they accept."
          action={
            <Button variant="primary" icon={<Plus />} onClick={openNew}>
              New quote
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile: cards — the quotes table scrolls sideways on a phone */}
          <div className="flex flex-col gap-3 md:hidden">
            {quotes.map((q) => (
              <button key={q.id} onClick={() => setDetailId(q.id)}
                className="surface flex items-center gap-3 rounded-2xl p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[15px] font-bold tracking-tight text-ink">{q.number}</span>
                    <StatusPill q={q} />
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] text-ink2">{q.customer?.name ?? "—"}</div>
                  <div className="mt-1 text-[11.5px] text-ink3">Valid until {fmtDate(q.valid_until)}</div>
                </div>
                <div className="flex-none font-display text-[15px] font-bold tnum text-ink">{money(q.total)}</div>
              </button>
            ))}
          </div>

          {/* Tablet & desktop: table */}
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-panel2 text-left text-[11px] uppercase tracking-[0.07em] text-ink3">
                <Th>Quote</Th>
                <Th>Customer</Th>
                <Th>Total</Th>
                <Th>Valid until</Th>
                <Th>Status</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setDetailId(q.id)}
                  className="cursor-pointer border-b border-line2 last:border-b-0 hover:bg-brand-500/[0.06]"
                >
                  <Td className="font-semibold text-ink">{q.number}</Td>
                  <Td className="text-ink2">{q.customer?.name ?? "—"}</Td>
                  <Td className="font-semibold tnum">{money(q.total)}</Td>
                  <Td className="text-ink2">{fmtDate(q.valid_until)}</Td>
                  <Td>
                    <StatusPill q={q} />
                  </Td>
                  <Td className="text-ink3">›</Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* Create / edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="xl"
        icon={<ReceiptText />}
        title={editingId ? "Edit quote" : "New quote"}
        subtitle={editingId ? "Update this estimate for your customer" : "Create a professional quote for your customer"}
        footer={<>
          {step === 0
            ? <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            : <Button onClick={() => gotoQuote(step - 1, -1)} disabled={busy}>Back</Button>}
          {step < QUOTE_STEPS.length - 1 ? (
            <Button variant="primary" onClick={nextQuote} disabled={!quoteStepValid[step]}>Continue</Button>
          ) : editingId ? (
            <Button variant="primary" onClick={() => submit(false)} disabled={busy}
              icon={busy ? <Loader2 className="animate-spin" /> : undefined}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          ) : (
            <>
              <Button onClick={() => submit(false)} disabled={busy}>Save draft</Button>
              <Button variant="primary" onClick={() => submit(true)} disabled={busy}
                icon={busy ? <Loader2 className="animate-spin" /> : <Send />}>
                {busy ? "Working…" : "Create & send"}
              </Button>
            </>
          )}
        </>}
      >
        <div className="flex flex-col gap-5">
          {/* Progress — ● ━ ● ━ ○ ━ ○ + "Step N of 4" */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {QUOTE_STEPS.map((_, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 flex-none rounded-full transition-colors", i <= step ? "bg-brand-500" : "bg-line2")} />
                  {i < QUOTE_STEPS.length - 1 && <span className={cn("h-px w-4 flex-none transition-colors", i < step ? "bg-brand-500/50" : "bg-line")} />}
                </div>
              ))}
            </div>
            <span className="text-[11.5px] font-semibold text-ink3">Step {step + 1} of {QUOTE_STEPS.length}</span>
          </div>

          {/* Sliding step content — min-height keeps the modal from jumping */}
          <div className="min-h-[280px]">
            <motion.div key={step} custom={dir} variants={stepSlide} initial="enter" animate="center"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-5">

          {step === 0 && (<>
          {/* Customer + vehicle */}
          <div className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock label="Customer" required icon={<UserRound />} error={tried && problems.customer ? "Select a customer." : undefined}>
                <Combobox
                  ariaLabel="Customer"
                  value={customerId}
                  onChange={(id) => { setCustomerId(id); setVehicleId(""); }}
                  options={customers.map((c) => ({ value: c.id, label: c.name, keywords: `${c.phone ?? ""} ${c.email ?? ""}` }))}
                  searchable clearable
                  placeholder="Select a customer…"
                  searchPlaceholder="Search name or phone…"
                  emptyLabel="No customers yet"
                  leading={<UserRound className="h-4 w-4" />}
                  invalid={tried && problems.customer}
                  renderOption={(o) => {
                    const c = customers.find((x) => x.id === o.value);
                    return (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{o.label}</span>
                        {(c?.email || c?.phone) && <span className="block truncate text-[11.5px] text-ink3">{c?.email || c?.phone}</span>}
                      </span>
                    );
                  }}
                />
              </FieldBlock>
              <FieldBlock label="Vehicle" icon={<Car />} hint="Optional">
                <Combobox
                  ariaLabel="Vehicle"
                  value={vehicleId}
                  onChange={setVehicleId}
                  options={vehicles.map((v) => ({ value: v.id, label: vehicleLabel(v), keywords: `${v.license_plate ?? ""} ${v.color ?? ""}` }))}
                  clearable
                  disabled={!customerId}
                  placeholder={customerId ? "No vehicle" : "Pick a customer first"}
                  emptyLabel="No vehicles for this customer"
                  leading={<Car className="h-4 w-4" />}
                />
              </FieldBlock>
            </div>

            {/* Selected customer/vehicle as real entities */}
            {selectedCustomer && (
              <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
                <div className="flex items-center gap-2.5 bg-panel2/50 px-3 py-2.5">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-bold text-brand-500">{initials(selectedCustomer.name)}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-ink">{selectedCustomer.name}</div>
                    {selectedCustomer.email ? (
                      <div className="flex items-center gap-1 truncate text-[11.5px] text-ink3"><Mail className="h-3 w-3 flex-none" />{selectedCustomer.email}</div>
                    ) : selectedCustomer.phone ? (
                      <a href={`tel:${selectedCustomer.phone}`} className="flex items-center gap-1 truncate text-[11.5px] text-ink3 transition-colors hover:text-brand-500"><Phone className="h-3 w-3 flex-none" />{selectedCustomer.phone}</a>
                    ) : (
                      <div className="text-[11.5px] text-ink3">No contact info on file</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-panel2/50 px-3 py-2.5">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-panel2 text-ink3"><Car className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    {selectedVehicle ? (
                      <>
                        <div className="truncate text-[13px] font-semibold text-ink">{vehicleLabel(selectedVehicle)}</div>
                        {selectedVehicle.color && <div className="truncate text-[11.5px] text-ink3">{selectedVehicle.color}</div>}
                      </>
                    ) : (
                      <div className="text-[12.5px] text-ink3">{vehicles.length > 0 ? `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} on file` : "No vehicle on file"}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          </>)}

          {step === 1 && (<>
          {/* Line items — the hero section */}
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-brand-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink2">Line items</span>
              <button
                type="button"
                onClick={() => setLines((l) => [...l, blankLine()])}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2/60 px-2.5 py-1.5 text-[12px] font-semibold text-ink2 transition-[transform,border-color,color,background-color] duration-150 hover:border-brand-500/50 hover:bg-brand-500/[0.06] hover:text-brand-500 active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" /> Add line
              </button>
            </div>

            {/* Column headers — desktop only */}
            <div className="mb-1.5 hidden grid-cols-[minmax(0,1fr)_52px_100px_88px_28px] gap-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink3 sm:grid">
              <span>Item</span><span>Qty</span><span>Unit price</span><span className="text-right">Total</span><span />
            </div>

            <div className="flex flex-col gap-2.5">
              {lines.map((l, i) => {
                const lineTotal = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
                const qtyBad = l.description.trim() !== "" && (Number(l.quantity) || 0) <= 0;
                const priceBad = Number(l.unit_price) < 0;
                return (
                  <div key={l.id} className="animate-fade-up rounded-xl bg-panel2/40 p-2.5 ring-1 ring-inset ring-line/70 sm:rounded-none sm:bg-transparent sm:p-0 sm:ring-0">
                    <select
                      className="input mb-2 h-9 text-[12.5px] font-medium sm:mb-1.5"
                      value={l.service_id ?? ""}
                      onChange={(e) => (e.target.value ? pickService(i, e.target.value) : setLine(i, { service_id: null }))}
                    >
                      <option value="">Custom line item — or select a service…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} · {money(s.price)}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-[minmax(0,1fr)_52px_100px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_52px_100px_88px_28px]">
                      <input className="input h-9" placeholder="Description" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                      <input className={cn("input h-9 tnum", qtyBad && "border-danger/60")} type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                      <input className={cn("input h-9 tnum", priceBad && "border-danger/60")} type="number" min={0} step="0.01" placeholder="0.00" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} />
                      <span className="hidden text-right text-[14px] font-bold tnum text-ink sm:block">{money(lineTotal)}</span>
                      <button
                        className="hidden h-9 w-7 items-center justify-center rounded-lg text-ink3 transition-colors hover:text-danger disabled:opacity-30 sm:flex"
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                        aria-label="Remove line"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {/* Mobile: line total + remove */}
                    <div className="mt-2 flex items-center justify-between sm:hidden">
                      <span className="text-[12px] text-ink3">Line total <b className="text-[13px] tnum text-ink">{money(lineTotal)}</b></span>
                      <button className="inline-flex items-center gap-1 text-[12px] font-medium text-ink3 transition-colors hover:text-danger disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                        <XIcon className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {tried && problems.lines && <p className="mt-2 text-[11.5px] text-danger">Add at least one line with a description and a quantity above 0.</p>}
          </div>
          </>)}

          {step === 2 && (<>
          {/* Adjustments */}
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-brand-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink2">Adjustments</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock label="Discount" error={problems.discount ? "Discount can't exceed the subtotal." : undefined}>
                <div className="flex gap-2">
                  <div className="flex flex-none rounded-lg bg-panel2 p-0.5 text-[13px] font-semibold ring-1 ring-inset ring-line">
                    {(["amount", "percent"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setDiscountMode(m)}
                        className={cn("w-9 rounded-md py-1.5 transition-colors", discountMode === m ? "bg-brand-500/15 text-brand-500" : "text-ink3 hover:text-ink")}>
                        {m === "amount" ? "$" : "%"}
                      </button>
                    ))}
                  </div>
                  <input className="input tnum" type="number" min={0} step={discountMode === "percent" ? 1 : 0.01}
                    placeholder={discountMode === "percent" ? "0" : "0.00"} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                </div>
                {discountAmount > 0 && !problems.discount && <p className="mt-1 text-[11.5px] text-ink3">− {money(discountAmount)} off the subtotal</p>}
              </FieldBlock>

              <FieldBlock label={`${taxLabel} rate (%)`} hint={defaultTaxRate != null ? "From settings" : undefined}
                error={taxRateNum < 0 ? "Tax rate can't be negative." : undefined}>
                <input className="input tnum" type="number" min={0} step="0.01" placeholder="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                {taxAmount > 0 && <p className="mt-1 text-[11.5px] text-ink3">= {money(taxAmount)} {taxLabel.toLowerCase()}</p>}
              </FieldBlock>
            </div>
          </div>

          {/* Expiration */}
          <FieldBlock label="Quote expires" icon={<CalendarClock />} error={problems.expires ? "Expiration can't be before today." : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              {[7, 14, 30].map((d) => {
                const target = new Date(); target.setDate(target.getDate() + d);
                const active = validUntil === target.toISOString().slice(0, 10);
                return (
                  <button key={d} type="button" onClick={() => setExpiryDays(d)}
                    className={cn("h-10 rounded-lg border px-3.5 text-[12.5px] font-semibold transition-[transform,border-color,background-color,color] duration-150 active:scale-[0.97]",
                      active ? "border-brand-500 bg-brand-500/[0.08] text-brand-500" : "border-line bg-panel2/50 text-ink2 hover:border-ink3/50")}>
                    {d} days
                  </button>
                );
              })}
              <input className="input h-10 w-auto min-w-[150px] flex-1" type="date" min={todayStr} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </FieldBlock>

          {/* Total summary */}
          <div className="overflow-hidden rounded-xl border border-brand-500/20 bg-gradient-to-b from-brand-500/[0.06] to-brand-500/[0.015] shadow-[0_1px_2px_rgba(16,22,38,0.04),0_10px_26px_-16px_rgba(46,123,255,0.28)]">
            <div className="flex flex-col gap-1.5 px-4 py-3.5 text-[13px]">
              <div className="flex items-center justify-between"><span className="text-ink2">Subtotal</span><span className="tnum text-ink">{money(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex items-center justify-between"><span className="text-ink2">Discount</span><span className="tnum text-ink">− {money(discountAmount)}</span></div>}
              {taxAmount > 0 && <div className="flex items-center justify-between"><span className="text-ink2">{taxLabel}{taxRateNum ? ` (${taxRateNum}%)` : ""}</span><span className="tnum text-ink">{money(taxAmount)}</span></div>}
            </div>
            <div className="flex items-end justify-between border-t border-brand-500/20 bg-brand-500/[0.04] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink2">Total</span>
              <span className="font-display text-[26px] font-bold leading-none tnum text-ink">{money(total)}</span>
            </div>
          </div>
          </>)}

          {step === 3 && (<>
          {/* Review — a compact summary before creating the quote */}
          <div className="rounded-xl border border-line bg-panel2/40 p-3.5 text-[13px]">
            <div className="flex flex-col gap-2">
              {([
                ["Customer", selectedCustomer?.name ?? "—"],
                ["Vehicle", selectedVehicle ? vehicleLabel(selectedVehicle) : "None"],
                ["Line items", `${validLines.length} item${validLines.length === 1 ? "" : "s"}`],
                ["Subtotal", money(subtotal)],
                ...(discountAmount > 0 ? [["Discount", `− ${money(discountAmount)}`] as [string, string]] : []),
                ...(taxAmount > 0 ? [[`${taxLabel}${taxRateNum ? ` (${taxRateNum}%)` : ""}`, money(taxAmount)] as [string, string]] : []),
                ["Expires", validUntil ? fmtDate(validUntil) : "—"],
              ] as [string, string][]).map(([l, v]) => (
                <div key={l} className="flex items-baseline justify-between gap-3">
                  <span className="flex-none text-ink3">{l}</span>
                  <span className="min-w-0 truncate text-right font-medium text-ink">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">Total</span>
              <span className="font-display text-[19px] font-bold tnum text-ink">{money(total)}</span>
            </div>
          </div>

          <FieldBlock label="Customer note" icon={<StickyNote />} hint="Shown on the quote">
            <textarea className="input" rows={2} placeholder="Add details about what's included, preparation instructions, or terms…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FieldBlock>

          <FieldBlock label="Internal note" icon={<Lock />} hint="Staff only · never shown to customer">
            <textarea className="input" rows={2} placeholder="Private reference — pricing rationale, prep reminders, upsell ideas…" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </FieldBlock>
          </>)}

            </motion.div>
          </div>

          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        </div>
      </Modal>

      {/* Detail / actions */}
      <QuoteDetail
        quote={detail}
        api={quotesApi}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
      />
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink2">{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

/** A div-based labelled field (so it can safely wrap a button-driven Combobox),
 *  with an optional required marker, right-aligned hint, and inline error. */
function FieldBlock({ label, required, hint, error, icon, children }: {
  label: string; required?: boolean; hint?: string; error?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">
        {icon && <span className="text-ink3 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        <span>{label}</span>
        {required && <span className="text-danger" aria-hidden>*</span>}
        {hint && <span className="ml-auto font-medium normal-case tracking-normal text-ink3">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[11.5px] text-danger">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuoteDetail({
  quote,
  api,
  onClose,
  onEdit,
}: {
  quote: Quote | null;
  api: ReturnType<typeof useQuotes>;
  onClose: () => void;
  onEdit: (q: Quote) => void;
}) {
  const [detailLines, setDetailLines] = useState<QuoteLineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("60");

  useEffect(() => {
    if (quote) {
      setErr(null);
      setScheduling(false);
      api.loadLines(quote.id).then(setDetailLines);
    }
  }, [quote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quote) return null;
  const status = effectiveQuoteStatus(quote);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(quote)}
      onClose={onClose}
      title={`${quote.number} · ${quote.customer?.name ?? "Customer"}`}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[13px]">
          <StatusPill q={quote} />
          {quote.vehicle && <span className="text-ink3">· {vehicleLabel(quote.vehicle)}</span>}
          <span className="ml-auto text-ink3">Valid until {fmtDate(quote.valid_until)}</span>
        </div>

        <div className="rounded-lg border border-line">
          {detailLines.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-line2 px-3 py-2 text-[13px] last:border-b-0">
              <span>
                {l.description}
                <span className="text-ink3"> × {l.quantity}</span>
              </span>
              <span className="tnum">{money(l.amount)}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1 px-3 py-2.5 text-[13px]">
            <Row label="Subtotal" value={money(quote.subtotal)} />
            {quote.discount > 0 && <Row label="Discount" value={`- ${money(quote.discount)}`} />}
            {quote.tax > 0 && <Row label="Tax" value={money(quote.tax)} />}
            <div className="mt-1 border-t border-line pt-1.5">
              <Row label={<b>Total</b>} value={<b className="tnum">{money(quote.total)}</b>} />
            </div>
          </div>
        </div>

        {quote.notes && <div className="rounded-lg bg-panel2 px-3 py-2 text-[13px] text-ink2">{quote.notes}</div>}

        {quote.internal_notes && (
          <div className="rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2 text-[13px] text-ink2">
            <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-warning">
              <EyeOff className="h-3.5 w-3.5" /> Internal note · not shown to the customer
            </div>
            <div className="whitespace-pre-wrap">{quote.internal_notes}</div>
          </div>
        )}

        {/* Conversion status */}
        {(quote.converted_invoice_id || quote.converted_appointment_id) && (
          <div className="flex flex-wrap gap-2 text-[12.5px]">
            {quote.converted_invoice_id && (
              <Link to="/invoices" className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1 font-semibold text-success">
                <Receipt className="h-3.5 w-3.5" /> Invoice created
              </Link>
            )}
            {quote.converted_appointment_id && (
              <Link to="/appointments" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-2.5 py-1 font-semibold text-brand-500">
                <CalendarPlus className="h-3.5 w-3.5" /> Appointment booked
              </Link>
            )}
          </div>
        )}

        {err && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{err}</div>}

        {/* Actions by status */}
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {status === "draft" && (
            <>
              <Button variant="primary" icon={<Send />} disabled={busy} onClick={() => run(() => api.setStatus(quote.id, "sent"))}>
                Send
              </Button>
              <Button icon={<Pencil />} onClick={() => onEdit(quote)}>
                Edit
              </Button>
            </>
          )}
          {status === "sent" && (
            <>
              <Button variant="primary" icon={<Check />} disabled={busy} onClick={() => run(() => api.setStatus(quote.id, "accepted"))}>
                Mark accepted
              </Button>
              <Button icon={<XIcon />} disabled={busy} onClick={() => run(() => api.setStatus(quote.id, "declined"))}>
                Decline
              </Button>
            </>
          )}
          {status === "expired" && <span className="text-[12.5px] text-warning">This quote has expired.</span>}

          {status === "accepted" && (
            <>
              {!quote.converted_invoice_id && (
                <Button variant="primary" icon={<Receipt />} disabled={busy} onClick={() => run(() => api.convertToInvoice(quote.id))}>
                  Convert to invoice
                </Button>
              )}
              {!quote.converted_appointment_id && !scheduling && (
                <Button icon={<CalendarPlus />} onClick={() => setScheduling(true)}>
                  Convert to appointment
                </Button>
              )}
            </>
          )}

          {/* Delete is always available */}
          <IconBtn
            label="Delete quote"
            danger
            onClick={async () => {
              if (await confirm({ title: `Delete quote ${quote.number}?`, body: "This permanently removes the quote and its line items.", confirmLabel: "Delete quote", tone: "danger" })) {
                run(async () => {
                  await api.remove(quote.id);
                  onClose();
                  toast.success("Quote deleted");
                });
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </IconBtn>
        </div>

        {/* Schedule sub-form for appointment conversion */}
        {status === "accepted" && scheduling && !quote.converted_appointment_id && (
          <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
            <div className="grid grid-cols-[1fr_84px] gap-2">
              <Field label="Date & time">
                <input className="input h-9" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </Field>
              <Field label="Minutes">
                <input className="input h-9" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setScheduling(false)}>Cancel</Button>
              <Button
                variant="primary"
                icon={<ArrowRight />}
                disabled={busy || !when}
                onClick={() =>
                  run(() => api.convertToAppointment(quote.id, new Date(when).toISOString(), Number(duration) || 60))
                }
              >
                Book appointment
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

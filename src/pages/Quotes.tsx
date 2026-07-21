import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { Th, Td, IconBtn, Loading, EmptyState, SignInPrompt, money } from "@/components/ui/data";
import { useQuotes, type QuoteInput } from "@/hooks/useQuotes";
import { useCustomers } from "@/hooks/useCustomers";
import { useServices } from "@/hooks/useServices";
import { useVehicles } from "@/hooks/useVehicles";
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

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: "text-ink2 bg-line2",
  sent: "text-brand-500 bg-brand-500/10",
  accepted: "text-success bg-success/10",
  declined: "text-danger bg-danger/10",
  expired: "text-warning bg-warning/10",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

type LineRow = { service_id: string | null; description: string; quantity: number; unit_price: number };
const blankLine = (): LineRow => ({ service_id: null, description: "", quantity: 1, unit_price: 0 });

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
  const ent = useEntitlements();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [lines, setLines] = useState<LineRow[]>([blankLine()]);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines]
  );
  const total = subtotal - (Number(discount) || 0) + (Number(tax) || 0);
  const detail = quotes.find((q) => q.id === detailId) ?? null;

  // ---- gates ----
  if (ent.loading) return <Loading />;
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
    setDiscount("");
    setTax("");
    setValidUntil("");
    setNotes("");
    setError(null);
  };

  const openNew = () => {
    resetForm();
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = async (q: Quote) => {
    const ls = await quotesApi.loadLines(q.id);
    setEditingId(q.id);
    setCustomerId(q.customer_id);
    setVehicleId(q.vehicle_id ?? "");
    setLines(
      ls.length
        ? ls.map((l) => ({ service_id: l.service_id ?? null, description: l.description, quantity: l.quantity, unit_price: l.unit_price }))
        : [blankLine()]
    );
    setDiscount(q.discount ? String(q.discount) : "");
    setTax(q.tax ? String(q.tax) : "");
    setValidUntil(q.valid_until ? q.valid_until.slice(0, 10) : "");
    setNotes(q.notes ?? "");
    setError(null);
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

  const save = async () => {
    if (!customerId) return setError("Choose a customer.");
    if (!lines.some((l) => l.description.trim())) return setError("Add at least one line item.");
    setBusy(true);
    setError(null);
    try {
      const input: QuoteInput = {
        customer_id: customerId,
        vehicle_id: vehicleId || null,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        notes: notes || null,
        valid_until: validUntil || null,
        lines: lines
          .filter((l) => l.description.trim())
          .map((l) => ({ service_id: l.service_id, description: l.description, quantity: Number(l.quantity) || 1, unit_price: Number(l.unit_price) || 0 })),
      };
      if (editingId) await quotesApi.update(editingId, input);
      else await quotesApi.create(input);
      setFormOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

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
        <Loading />
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
        <div className="overflow-x-auto">
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
      )}

      {/* Create / edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Edit quote" : "New quote"}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : editingId ? "Save changes" : "Create quote"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer">
              <select
                className="input"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setVehicleId("");
                }}
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vehicle (optional)">
              <VehicleSelect customerId={customerId} value={vehicleId} onChange={setVehicleId} />
            </Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.07em] text-ink2">Line items</span>
              <button className="text-[12.5px] font-semibold text-brand-500" onClick={() => setLines((l) => [...l, blankLine()])}>
                + Add line
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_56px_84px_28px] items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <select
                      className="input h-9 text-[12.5px]"
                      value={l.service_id ?? ""}
                      onChange={(e) => (e.target.value ? pickService(i, e.target.value) : setLine(i, { service_id: null }))}
                    >
                      <option value="">Custom line…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {money(s.price)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input h-9"
                      placeholder="Description"
                      value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                    />
                  </div>
                  <input
                    className="input h-9"
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
                  />
                  <input
                    className="input h-9"
                    type="number"
                    placeholder="0.00"
                    value={l.unit_price}
                    onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })}
                  />
                  <button
                    className="flex h-9 w-7 items-center justify-center rounded-lg text-ink3 hover:text-danger disabled:opacity-30"
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    aria-label="Remove line"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Discount ($)">
              <input className="input" type="number" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            <Field label="Tax ($)">
              <input className="input" type="number" placeholder="0.00" value={tax} onChange={(e) => setTax(e.target.value)} />
            </Field>
            <Field label="Valid until">
              <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-col gap-1 rounded-lg bg-panel2 px-3.5 py-2.5 text-[13px]">
            <Row label="Subtotal" value={money(subtotal)} />
            {Number(discount) > 0 && <Row label="Discount" value={`- ${money(Number(discount))}`} />}
            {Number(tax) > 0 && <Row label="Tax" value={money(Number(tax))} />}
            <div className="mt-1 border-t border-line pt-1.5">
              <Row label={<b>Total</b>} value={<b className="tnum">{money(total)}</b>} />
            </div>
          </div>

          <Field label="Notes">
            <textarea className="input" rows={2} placeholder="Anything the customer should know" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

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

function VehicleSelect({ customerId, value, onChange }: { customerId: string; value: string; onChange: (v: string) => void }) {
  const { vehicles } = useVehicles(customerId || null);
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} disabled={!customerId}>
      <option value="">No vehicle</option>
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {vehicleLabel(v)}
        </option>
      ))}
    </select>
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
            onClick={() =>
              window.confirm(`Delete quote ${quote.number}?`) &&
              run(async () => {
                await api.remove(quote.id);
                onClose();
              })
            }
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

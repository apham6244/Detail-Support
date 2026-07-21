import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import {
  Plus, FileText, Trash2, Send, X, Clock, DollarSign, Search, SlidersHorizontal,
  Download, MoreHorizontal, Eye, CheckCircle2, Copy, AlertCircle, TrendingUp,
  TrendingDown, Receipt, Wallet, CalendarDays, MailCheck, Printer, Loader2,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Field } from "@/components/ui/Modal";
import { Loading, EmptyState, SignInPrompt, money } from "@/components/ui/data";
import { CountUp } from "@/components/ui/CountUp";
import { useInvoices, type NewInvoice } from "@/hooks/useInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useEntitlements } from "@/lib/entitlements";
import { FeatureLocked } from "@/components/UpgradeGate";
import { INVOICE_STATUS_LABEL, type Invoice, type InvoiceLineItem, type InvoiceStatus } from "@/lib/models";
import { cn } from "@/lib/cn";

const STATUSES: InvoiceStatus[] = ["unpaid", "deposit_paid", "balance_due", "paid"];

type LineRow = { description: string; quantity: number; unit_price: number };
const blankLine = (): LineRow => ({ description: "", quantity: 1, unit_price: 0 });

// ---- derived helpers -------------------------------------------------------

/** Money actually collected on an invoice. */
const collectedOf = (i: Invoice) =>
  i.status === "paid" ? i.total : i.status === "deposit_paid" ? i.deposit_amount : 0;
const balanceOf = (i: Invoice) => Math.max(0, i.total - collectedOf(i));
const isOverdue = (i: Invoice) =>
  balanceOf(i) > 0.005 && !!i.due_at && new Date(i.due_at).getTime() < Date.now();

/** The badge a row shows — real statuses, plus a derived "Overdue". */
type BadgeKey = InvoiceStatus | "overdue";
const BADGE: Record<BadgeKey, { label: string; cls: string; dot: string }> = {
  paid:         { label: "Paid",         cls: "bg-success/12 text-success ring-success/25", dot: "bg-success" },
  unpaid:       { label: "Pending",      cls: "bg-warning/12 text-warning ring-warning/25", dot: "bg-warning" },
  overdue:      { label: "Overdue",      cls: "bg-danger/12 text-danger ring-danger/25",    dot: "bg-danger" },
  deposit_paid: { label: "Deposit paid", cls: "bg-violet/12 text-violet ring-violet/25",    dot: "bg-violet" },
  balance_due:  { label: "Balance due",  cls: "bg-brand-500/12 text-brand-500 ring-brand-500/25", dot: "bg-brand-500" },
};
const badgeKey = (i: Invoice): BadgeKey => (isOverdue(i) ? "overdue" : i.status);

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtShort = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

function lastMonths(n: number) {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString(undefined, { month: "short" }) });
  }
  return out;
}
const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type SortKey = "newest" | "oldest" | "amount_desc" | "amount_asc" | "customer";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "amount_desc", label: "Amount: high to low" },
  { key: "amount_asc", label: "Amount: low to high" },
  { key: "customer", label: "Customer (A–Z)" },
];

type RangeKey = "all" | "30" | "90" | "year";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "year", label: "This year" },
];

export default function Invoices() {
  const { invoices, loading, ready, create, setStatus, markSent, remove, getLineItems } = useInvoices();
  const { customers } = useCustomers();
  const ent = useEntitlements();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Invoice | null>(null);

  // toolbar
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BadgeKey | "all">("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  // new-invoice form
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<LineRow[]>([blankLine()]);
  const [tax, setTax] = useState("");
  const [deposit, setDeposit] = useState("");
  const [notes, setNotes] = useState("");

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines]
  );
  const total = subtotal + (Number(tax) || 0);

  const months = useMemo(() => lastMonths(6), []);

  const summary = useMemo(() => {
    let coll = 0, out = 0, unpaid = 0, overdue = 0, overdueAmt = 0;
    for (const inv of invoices) {
      coll += collectedOf(inv);
      const bal = balanceOf(inv);
      if (bal > 0.005) { out += bal; unpaid += 1; }
      if (isOverdue(inv)) { overdue += 1; overdueAmt += bal; }
    }
    const avg = invoices.length ? invoices.reduce((s, i) => s + i.total, 0) / invoices.length : 0;

    // 6-month sparkline series
    const collByMonth: Record<string, number> = {};
    const balByMonth: Record<string, number> = {};
    const cntByMonth: Record<string, number> = {};
    const totByMonth: Record<string, number> = {};
    for (const inv of invoices) {
      const k = monthKey(inv.issued_at || inv.created_at);
      collByMonth[k] = (collByMonth[k] ?? 0) + collectedOf(inv);
      balByMonth[k] = (balByMonth[k] ?? 0) + balanceOf(inv);
      cntByMonth[k] = (cntByMonth[k] ?? 0) + 1;
      totByMonth[k] = (totByMonth[k] ?? 0) + inv.total;
    }
    const series = (src: Record<string, number>) => months.map((m) => ({ value: src[m.key] ?? 0 }));
    const avgSeries = months.map((m) => ({ value: cntByMonth[m.key] ? (totByMonth[m.key] ?? 0) / cntByMonth[m.key] : 0 }));

    return {
      collected: coll, outstanding: out, unpaid, count: invoices.length, overdue, overdueAmt, avg,
      collSeries: series(collByMonth), balSeries: series(balByMonth),
      cntSeries: series(cntByMonth), avgSeries,
    };
  }, [invoices, months]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      range === "30" ? now - 30 * 86_400_000 :
      range === "90" ? now - 90 * 86_400_000 :
      range === "year" ? new Date(new Date().getFullYear(), 0, 1).getTime() : 0;

    const list = invoices.filter((i) => {
      if (statusFilter !== "all" && badgeKey(i) !== statusFilter) return false;
      if (customerFilter !== "all" && i.customer_id !== customerFilter) return false;
      if (cutoff && new Date(i.issued_at || i.created_at).getTime() < cutoff) return false;
      if (q) {
        const hay = `${i.number ?? ""} ${i.customer?.name ?? ""} ${i.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const t = (i: Invoice) => new Date(i.issued_at || i.created_at).getTime();
    return list.slice().sort((a, b) => {
      switch (sort) {
        case "oldest": return t(a) - t(b);
        case "amount_desc": return b.total - a.total;
        case "amount_asc": return a.total - b.total;
        case "customer": return (a.customer?.name ?? "").localeCompare(b.customer?.name ?? "");
        default: return t(b) - t(a);
      }
    });
  }, [invoices, query, statusFilter, customerFilter, range, sort]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { all: invoices.length };
    for (const i of invoices) { const k = badgeKey(i); m[k] = (m[k] ?? 0) + 1; }
    return m;
  }, [invoices]);

  const openNew = () => {
    setCustomerId(""); setLines([blankLine()]); setTax(""); setDeposit(""); setNotes("");
    setError(null); setOpen(true);
  };

  const save = async () => {
    if (!customerId) return setError("Choose a customer.");
    setBusy(true);
    setError(null);
    try {
      const input: NewInvoice = {
        customer_id: customerId,
        tax: Number(tax) || 0,
        deposit_amount: Number(deposit) || 0,
        notes: notes || null,
        lines,
      };
      await create(input);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  /** Duplicate: pull the original's real line items, then create a fresh invoice. */
  const duplicate = async (inv: Invoice) => {
    const items = await getLineItems(inv.id);
    await create({
      customer_id: inv.customer_id,
      tax: inv.tax,
      deposit_amount: 0,
      notes: inv.notes,
      lines: items.length
        ? items.map((l) => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price }))
        : [{ description: `Copy of ${inv.number ?? "invoice"}`, quantity: 1, unit_price: inv.subtotal }],
    });
  };

  /** Export the current (filtered) view as CSV. */
  const exportCsv = () => {
    const rows = [
      ["Invoice", "Customer", "Status", "Issued", "Due", "Total", "Collected", "Balance", "Sent"],
      ...filtered.map((i) => [
        i.number ?? "", i.customer?.name ?? "", BADGE[badgeKey(i)].label,
        i.issued_at ? new Date(i.issued_at).toISOString().slice(0, 10) : "",
        i.due_at ? new Date(i.due_at).toISOString().slice(0, 10) : "",
        i.total.toFixed(2), collectedOf(i).toFixed(2), balanceOf(i).toFixed(2),
        i.sent_at ? "yes" : "no",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (ready && ent.loading) return <Loading />;
  if (ready && !ent.hasFeature("invoices")) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Invoices" subtitle="Billing &amp; payments" />
        <FeatureLocked feature="invoices" title="Invoices"
          description="Create invoices, record deposits, and track how customers pay for completed jobs." />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Invoices"
        subtitle="Track what you've billed, what's landed, and what's still owed"
        actions={
          ready ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportCsv}
                disabled={!invoices.length}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink2 transition hover:border-ink3 disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Export
              </button>
              <Button variant="primary" icon={<Plus />} onClick={openNew}>New invoice</Button>
            </div>
          ) : undefined
        }
      />

      {!ready ? (
        <SignInPrompt what="invoices" />
      ) : loading ? (
        <Loading />
      ) : invoices.length === 0 ? (
        <EmptyState
          art="receipt"
          title="No invoices yet"
          body="Create an invoice for a completed job, then mark how the customer paid."
          action={<Button variant="primary" icon={<Plus />} onClick={openNew}>New invoice</Button>}
        />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi index={0} tone="amber" icon={Clock} label="Outstanding" value={summary.outstanding} isMoney
              sub={`${summary.unpaid} unpaid`} series={summary.balSeries} />
            <Kpi index={1} tone="green" icon={DollarSign} label="Collected" value={summary.collected} isMoney
              sub="all time" series={summary.collSeries} />
            <Kpi index={2} tone="blue" icon={FileText} label="Total invoices" value={summary.count}
              sub={`${months[months.length - 1].label} to date`} series={summary.cntSeries} />
            <Kpi index={3} tone="red" icon={AlertCircle} label="Overdue" value={summary.overdue}
              sub={summary.overdue ? money(summary.overdueAmt) : "nothing late"} series={summary.balSeries} />
            <Kpi index={4} tone="violet" icon={Receipt} label="Average invoice" value={summary.avg} isMoney
              sub="per invoice" series={summary.avgSeries} />
          </div>

          {/* Toolbar */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-ink3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search invoice #, customer, notes…" className="input h-11 rounded-xl pl-9" />
            </div>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
              className="input h-11 w-auto cursor-pointer rounded-xl text-[13px] font-medium">
              <option value="all">All customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}
              className="input h-11 w-auto cursor-pointer rounded-xl text-[13px] font-medium">
              {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink3" />
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                className="input h-11 w-auto cursor-pointer rounded-xl pl-9 text-[13px] font-medium">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Status chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(["all", "paid", "unpaid", "overdue", "deposit_paid", "balance_due"] as const)
              .filter((k) => k === "all" || (statusCounts[k] ?? 0) > 0)
              .map((k) => {
                const on = statusFilter === k;
                return (
                  <button key={k} onClick={() => setStatusFilter(k)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.97]",
                      on ? "bg-brand-500 text-white shadow-glow" : "text-ink3 ring-1 ring-inset ring-line hover:bg-line2 hover:text-ink"
                    )}>
                    {k !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-white/80" : BADGE[k].dot)} />}
                    {k === "all" ? "All invoices" : BADGE[k].label}
                    <span className={cn("tnum text-[11px] font-bold", on ? "text-white/80" : "text-ink3")}>
                      {statusCounts[k] ?? 0}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-line px-4 py-14 text-center text-[13px] text-ink3">
              No invoices match your filters.
            </div>
          ) : (
            <div className="surface mt-5 overflow-hidden rounded-[18px]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.08em] text-ink3">
                      <th className="px-5 py-3.5 font-semibold">Invoice</th>
                      <th className="px-5 py-3.5 font-semibold">Customer</th>
                      <th className="px-5 py-3.5 font-semibold">Dates</th>
                      <th className="px-5 py-3.5 text-right font-semibold">Amount</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="w-14 px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line2">
                    {filtered.map((inv, i) => (
                      <InvoiceRow
                        key={inv.id} inv={inv} index={i}
                        onOpen={() => setPreview(inv)}
                        onStatus={(s) => setStatus(inv.id, s)}
                        onSend={() => markSent(inv.id)}
                        onDuplicate={() => duplicate(inv)}
                        onDelete={() => { if (window.confirm(`Delete ${inv.number ?? "this invoice"}?`)) remove(inv.id); }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {preview && (
        <InvoicePreview
          inv={preview}
          getLineItems={getLineItems}
          onClose={() => setPreview(null)}
          onStatus={(s) => setStatus(preview.id, s)}
          onSend={() => markSent(preview.id)}
        />
      )}

      {/* New invoice — unchanged behaviour */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New invoice"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || !customerId}>
              {busy ? "Saving…" : "Create invoice"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Customer">
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.07em] text-ink2">Line items</span>
              <button onClick={() => setLines((l) => [...l, blankLine()])} className="text-[12.5px] font-semibold text-brand-500">
                + Add line
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input flex-1" placeholder="Description (e.g. Full Detail)"
                    value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                  <input className="input w-14 tnum" type="number" min={0} value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} title="Qty" />
                  <input className="input w-24 tnum" type="number" min={0} step="0.01" value={l.unit_price}
                    onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} title="Unit price" />
                  {lines.length > 1 && (
                    <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                      className="text-ink3 hover:text-danger" aria-label="Remove line">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tax ($)">
              <input className="input tnum" type="number" min={0} step="0.01" value={tax}
                onChange={(e) => setTax(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Deposit paid ($)">
              <input className="input tnum" type="number" min={0} step="0.01" value={deposit}
                onChange={(e) => setDeposit(e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          <div className="rounded-lg bg-panel2 px-3.5 py-2.5 text-[13px]">
            <div className="flex justify-between text-ink2"><span>Subtotal</span><span className="tnum">{money(subtotal)}</span></div>
            <div className="mt-1 flex justify-between font-semibold"><span>Total</span><span className="tnum">{money(total)}</span></div>
          </div>

          <Field label="Notes">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment method (cash, Zelle, Venmo…) or job notes" />
          </Field>
          {error && <div className="text-[12.5px] text-danger">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Tone = "amber" | "green" | "blue" | "red" | "violet";
const TONE: Record<Tone, { hex: string; bubble: string; glow: string }> = {
  amber:  { hex: "#E0A100", bubble: "bg-warning/12 text-warning",     glow: "bg-warning/20" },
  green:  { hex: "#17A867", bubble: "bg-success/12 text-success",     glow: "bg-success/20" },
  blue:   { hex: "#2E7BFF", bubble: "bg-brand-500/12 text-brand-500", glow: "bg-brand-500/20" },
  red:    { hex: "#E5484D", bubble: "bg-danger/12 text-danger",       glow: "bg-danger/20" },
  violet: { hex: "#7A5BE0", bubble: "bg-violet/12 text-violet",       glow: "bg-violet/20" },
};

function Kpi({ index, tone, icon: Icon, label, value, sub, series, isMoney }: {
  index: number; tone: Tone; icon: LucideIcon; label: string;
  value: number; sub: string; series: { value: number }[]; isMoney?: boolean;
}) {
  const t = TONE[tone];
  const gid = `kpi${index}`;
  const cur = series[series.length - 1]?.value ?? 0;
  const prev = series[series.length - 2]?.value ?? 0;
  const delta = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
  const up = delta >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="surface group relative overflow-hidden rounded-[18px] p-4 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-lift"
    >
      <div aria-hidden className={cn("pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-60 blur-3xl transition-opacity group-hover:opacity-90", t.glow)} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-paint-gloss opacity-40" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-8 w-8 flex-none items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", t.bubble)}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink3">{label}</span>
        </div>
        <CountUp value={value} format={isMoney ? (n) => money(n) : (n) => String(Math.round(n))}
          className="mt-3 block font-display text-[24px] font-bold leading-none tracking-[-0.02em] tnum text-ink" />
        <div className="mt-2 flex items-center gap-1.5">
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tnum",
            up ? "bg-success/12 text-success" : "bg-danger/12 text-danger")}>
            {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {up ? "+" : "−"}{Math.abs(Math.round(delta))}%
          </span>
          <span className="truncate text-[11px] text-ink3">{sub}</span>
        </div>
        <div className="-mx-1 mt-2 h-[34px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 3, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.hex} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={t.hex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={t.hex} strokeWidth={1.75} fill={`url(#${gid})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

function StatusBadge({ inv }: { inv: Invoice }) {
  const k = badgeKey(inv);
  const b = BADGE[k];
  return (
    <span className={cn("inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset transition-colors", b.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", b.dot)} />
      {b.label}
    </span>
  );
}

function InvoiceRow({ inv, index, onOpen, onStatus, onSend, onDuplicate, onDelete }: {
  inv: Invoice; index: number; onOpen: () => void;
  onStatus: (s: InvoiceStatus) => void; onSend: () => void;
  onDuplicate: () => void; onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const balance = balanceOf(inv);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.02 }}
      onClick={onOpen}
      className="group cursor-pointer transition-colors duration-150 hover:bg-panel2/60"
    >
      {/* Invoice number — the anchor */}
      <td className="px-5 py-4 align-middle">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500 transition-transform duration-200 group-hover:scale-105">
            <Receipt className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[15px] font-bold tracking-tight text-ink">{inv.number ?? "—"}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink3">
              {inv.sent_at ? (<><MailCheck className="h-3 w-3 text-success" /> Sent</>) : "Not sent"}
            </div>
          </div>
        </div>
      </td>

      <td className="px-5 py-4 align-middle">
        <div className="truncate text-[13.5px] font-medium text-ink2">{inv.customer?.name ?? "—"}</div>
        {inv.notes && <div className="mt-0.5 max-w-[220px] truncate text-[11.5px] text-ink3">{inv.notes}</div>}
      </td>

      <td className="px-5 py-4 align-middle">
        <div className="flex items-center gap-1 text-[11.5px] text-ink3">
          <CalendarDays className="h-3 w-3" /> Issued {fmtShort(inv.issued_at)}
        </div>
        {inv.due_at && (
          <div className={cn("mt-0.5 flex items-center gap-1 text-[11.5px]", isOverdue(inv) ? "font-semibold text-danger" : "text-ink3")}>
            <Clock className="h-3 w-3" /> Due {fmtShort(inv.due_at)}
          </div>
        )}
      </td>

      <td className="px-5 py-4 text-right align-middle">
        <div className="font-display text-[16px] font-bold leading-none tnum text-success">{money(inv.total)}</div>
        {balance > 0.005 ? (
          <div className="mt-1 text-[11px] text-ink3">{money(balance)} due</div>
        ) : (
          <div className="mt-1 text-[11px] text-ink3">paid in full</div>
        )}
      </td>

      <td className="px-5 py-4 align-middle"><StatusBadge inv={inv} /></td>

      {/* Actions */}
      <td className="px-5 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}
            aria-label="Invoice actions"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-ink3 transition-[opacity,background-color,color] duration-150 hover:bg-line2 hover:text-ink",
              "opacity-0 focus:opacity-100 group-hover:opacity-100", menu && "opacity-100 bg-line2 text-ink"
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.14 }}
              className="surface surface-raised absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-xl py-1 text-left"
            >
              <MenuItem icon={Eye} onClick={onOpen}>View invoice</MenuItem>
              {!inv.sent_at && <MenuItem icon={Send} onClick={onSend}>Mark as sent</MenuItem>}
              {inv.status !== "paid" && <MenuItem icon={CheckCircle2} onClick={() => onStatus("paid")}>Mark as paid</MenuItem>}
              {inv.status === "paid" && <MenuItem icon={Wallet} onClick={() => onStatus("unpaid")}>Mark as unpaid</MenuItem>}
              <MenuItem icon={Copy} onClick={onDuplicate}>Duplicate</MenuItem>
              <div className="my-1 h-px bg-line" />
              <MenuItem icon={Trash2} danger onClick={onDelete}>Delete</MenuItem>
            </motion.div>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }: {
  icon: LucideIcon; children: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-ink2 hover:bg-line2 hover:text-ink"
      )}
    >
      <Icon className="h-4 w-4 flex-none" />
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Invoice preview
// ---------------------------------------------------------------------------

function InvoicePreview({ inv, getLineItems, onClose, onStatus, onSend }: {
  inv: Invoice;
  getLineItems: (id: string) => Promise<InvoiceLineItem[]>;
  onClose: () => void;
  onStatus: (s: InvoiceStatus) => void;
  onSend: () => void;
}) {
  const [items, setItems] = useState<InvoiceLineItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    getLineItems(inv.id).then((l) => alive && setItems(l)).catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [inv.id, getLineItems]);

  const collected = collectedOf(inv);
  const balance = balanceOf(inv);

  const timeline = [
    { label: "Created", at: inv.created_at, done: true },
    { label: "Issued", at: inv.issued_at, done: Boolean(inv.issued_at) },
    { label: "Sent to customer", at: inv.sent_at, done: Boolean(inv.sent_at) },
    { label: inv.status === "paid" ? "Paid in full" : balance > 0.005 ? "Awaiting payment" : "Settled", at: null, done: inv.status === "paid" },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invoice ${inv.number ?? ""}`}
      footer={
        <>
          <Button onClick={() => window.print()}>
            <span className="inline-flex items-center gap-1.5"><Printer className="h-4 w-4" /> Print / PDF</span>
          </Button>
          {!inv.sent_at && <Button onClick={onSend}><span className="inline-flex items-center gap-1.5"><Send className="h-4 w-4" /> Mark sent</span></Button>}
          {inv.status !== "paid" && (
            <Button variant="primary" onClick={() => { onStatus("paid"); onClose(); }}>Mark as paid</Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3 rounded-2xl bg-panel2/50 p-4 ring-1 ring-inset ring-line/60">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink3">Billed to</div>
            <div className="mt-1 font-display text-[17px] font-bold tracking-tight text-ink">{inv.customer?.name ?? "—"}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink3">
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Issued {fmtDate(inv.issued_at)}</span>
              {inv.due_at && (
                <span className={cn("flex items-center gap-1", isOverdue(inv) && "font-semibold text-danger")}>
                  <Clock className="h-3 w-3" /> Due {fmtDate(inv.due_at)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <StatusBadge inv={inv} />
            <div className="mt-2 font-display text-[24px] font-bold leading-none tnum text-ink">{money(inv.total)}</div>
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Line items</div>
          {items === null ? (
            <div className="flex h-20 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-ink3" /></div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-line px-3 py-4 text-center text-[12.5px] text-ink3">
              No line items recorded on this invoice.
            </div>
          ) : (
            <div className="divide-y divide-line2 overflow-hidden rounded-xl ring-1 ring-inset ring-line">
              {items.map((l, i) => (
                <div key={l.id ?? i} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">{l.description}</div>
                    <div className="text-[11.5px] text-ink3">{l.quantity} × {money(l.unit_price)}</div>
                  </div>
                  <span className="tnum text-[13px] font-semibold text-ink">{money(l.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="rounded-xl bg-panel2/50 px-3.5 py-3 text-[13px] ring-1 ring-inset ring-line/60">
          <Row label="Subtotal" value={money(inv.subtotal)} />
          {inv.tax > 0 && <Row label="Tax" value={money(inv.tax)} />}
          <Row label="Total" value={money(inv.total)} strong />
          {inv.deposit_amount > 0 && <Row label="Deposit paid" value={`− ${money(inv.deposit_amount)}`} tone="success" />}
          <div className="mt-2 border-t border-line pt-2">
            <Row
              label={balance > 0.005 ? "Balance due" : "Collected"}
              value={money(balance > 0.005 ? balance : collected)}
              strong
              tone={balance > 0.005 ? "danger" : "success"}
            />
          </div>
        </div>

        {/* Timeline */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Timeline</div>
          <div className="flex flex-col gap-2.5">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className={cn("flex h-5 w-5 flex-none items-center justify-center rounded-full",
                  t.done ? "bg-success/15 text-success" : "bg-line2 text-ink3")}>
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                <span className={cn("text-[12.5px]", t.done ? "text-ink2" : "text-ink3")}>{t.label}</span>
                {t.at && <span className="ml-auto text-[11.5px] text-ink3">{fmtDate(t.at)}</span>}
              </div>
            ))}
          </div>
        </div>

        {inv.notes && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Notes</div>
            <p className="whitespace-pre-wrap rounded-xl bg-panel2/50 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink2 ring-1 ring-inset ring-line/60">
              {inv.notes}
            </p>
          </div>
        )}

        {/* Status switcher — same capability as before, just tidier */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">Set status</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => onStatus(s)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition",
                  inv.status === s ? BADGE[s].cls : "text-ink3 ring-line hover:bg-line2 hover:text-ink"
                )}>
                {INVOICE_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, strong, tone }: {
  label: string; value: string; strong?: boolean; tone?: "success" | "danger";
}) {
  return (
    <div className={cn("flex justify-between", strong ? "font-semibold text-ink" : "text-ink2", strong && "mt-1")}>
      <span>{label}</span>
      <span className={cn("tnum", tone === "success" && "text-success", tone === "danger" && "text-danger")}>{value}</span>
    </div>
  );
}

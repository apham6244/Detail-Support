import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DSIcon } from "@/components/brand/Logo";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Invoice, InvoiceLineItem } from "@/lib/models";

/**
 * A print-quality invoice document.
 *
 * Rendered into a portal on `document.body` (outside #root) and hidden on
 * screen — `@media print` in index.css swaps it in as the only visible element,
 * so "Download PDF" is just the browser's own print-to-PDF. That keeps the
 * output vector-sharp and adds zero dependencies (no jsPDF/html2canvas), which
 * matters because those rasterise text and bloat the bundle.
 *
 * Colours are hard-coded light values rather than theme tokens: this always
 * prints on white paper regardless of whether the app is in dark mode.
 */

const money = (n: number) =>
  `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

/** Money collected so far — deposit counts, a paid invoice counts in full. */
const paidOf = (inv: Invoice) =>
  inv.status === "paid" ? inv.total : inv.status === "deposit_paid" ? inv.deposit_amount : 0;

type StatusLook = { label: string; fg: string; bg: string; border: string };
function statusLook(inv: Invoice): StatusLook {
  const overdue = inv.status !== "paid" && inv.due_at && new Date(inv.due_at).getTime() < Date.now();
  if (inv.status === "paid") return { label: "PAID", fg: "#0F7A4A", bg: "#E7F6EE", border: "#B9E4CD" };
  if (overdue) return { label: "OVERDUE", fg: "#B4232A", bg: "#FDECEC", border: "#F6C9CB" };
  if (inv.status === "deposit_paid") return { label: "DEPOSIT PAID", fg: "#9A6100", bg: "#FDF3E2", border: "#F3DEB4" };
  if (inv.status === "balance_due") return { label: "BALANCE DUE", fg: "#9A6100", bg: "#FDF3E2", border: "#F3DEB4" };
  return { label: "UNPAID", fg: "#4A5568", bg: "#F1F3F7", border: "#DDE2EA" };
}

export function InvoiceDocument({ invoice, items, onDone }: {
  invoice: Invoice;
  items: InvoiceLineItem[];
  /** Called once the print dialog closes so the caller can unmount us. */
  onDone: () => void;
}) {
  const { ws } = useWorkspace();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Print once the document is actually in the DOM, then hand control back.
  useEffect(() => {
    if (!mounted) return;
    const done = () => {
      document.body.classList.remove("printing-invoice");
      onDone();
    };
    window.addEventListener("afterprint", done);
    document.body.classList.add("printing-invoice");
    // rAF twice: let layout settle before the (synchronous) print dialog opens.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing-invoice");
    };
  }, [mounted, onDone]);

  if (!mounted) return null;

  const biz = {
    name: ws?.name ?? "Detail Support",
    owner: ws?.settings?.owner_name ?? "",
    phone: ws?.settings?.phone ?? "",
    email: ws?.settings?.business_email ?? "",
    location: ws?.settings?.location ?? "",
  };
  const look = statusLook(invoice);
  const paid = paidOf(invoice);
  const balance = Math.max(0, invoice.total - paid);

  const ink = "#111826";
  const muted = "#6B7480";
  const line = "#E4E8EF";

  return createPortal(
    <div
      className="invoice-print"
      style={{
        background: "#fff", color: ink, padding: "0",
        font: "13px/1.5 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
      }}
    >
      {/* ---- Header: business identity + invoice marque -------------------- */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <DSIcon size={42} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>{biz.name}</div>
            <div style={{ marginTop: 4, color: muted, fontSize: 12, lineHeight: 1.7 }}>
              {biz.owner && <div>{biz.owner}</div>}
              {biz.location && <div>{biz.location}</div>}
              {biz.phone && <div>{biz.phone}</div>}
              {biz.email && <div>{biz.email}</div>}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.08em", color: ink }}>INVOICE</div>
          <div style={{ marginTop: 2, fontSize: 14, fontWeight: 700, color: muted }}>{invoice.number ?? "—"}</div>
          <div
            style={{
              display: "inline-block", marginTop: 10, padding: "5px 12px", borderRadius: 999,
              background: look.bg, color: look.fg, border: `1px solid ${look.border}`,
              fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
            }}
          >
            {look.label}
          </div>
        </div>
      </header>

      <div style={{ height: 1, background: line, margin: "22px 0" }} />

      {/* ---- Bill to + dates ---------------------------------------------- */}
      <section style={{ display: "flex", justifyContent: "space-between", gap: 32 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: muted }}>BILL TO</div>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>{invoice.customer?.name ?? "—"}</div>
        </div>
        <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            <tr>
              <td style={{ padding: "2px 0", color: muted, textAlign: "right", paddingRight: 14 }}>Invoice date</td>
              <td style={{ padding: "2px 0", fontWeight: 600, textAlign: "right" }}>{fmtDate(invoice.issued_at)}</td>
            </tr>
            <tr>
              <td style={{ padding: "2px 0", color: muted, textAlign: "right", paddingRight: 14 }}>Due date</td>
              <td style={{ padding: "2px 0", fontWeight: 600, textAlign: "right" }}>{fmtDate(invoice.due_at)}</td>
            </tr>
            {invoice.sent_at && (
              <tr>
                <td style={{ padding: "2px 0", color: muted, textAlign: "right", paddingRight: 14 }}>Sent</td>
                <td style={{ padding: "2px 0", fontWeight: 600, textAlign: "right" }}>{fmtDate(invoice.sent_at)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* ---- Services performed -------------------------------------------- */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 26 }}>
        <thead>
          <tr>
            <th style={th(muted, line, "left")}>Service</th>
            <th style={{ ...th(muted, line, "right"), width: 70 }}>Qty</th>
            <th style={{ ...th(muted, line, "right"), width: 110 }}>Rate</th>
            <th style={{ ...th(muted, line, "right"), width: 120 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: "18px 0", color: muted, textAlign: "center", borderBottom: `1px solid ${line}` }}>
                No line items on this invoice.
              </td>
            </tr>
          ) : (
            items.map((l, i) => (
              <tr key={l.id ?? i}>
                <td style={td(line)}>{l.description}</td>
                <td style={{ ...td(line), textAlign: "right" }}>{l.quantity}</td>
                <td style={{ ...td(line), textAlign: "right" }}>{money(l.unit_price)}</td>
                <td style={{ ...td(line), textAlign: "right", fontWeight: 600 }}>{money(l.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ---- Totals --------------------------------------------------------- */}
      <section style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <table style={{ borderCollapse: "collapse", minWidth: 290, fontSize: 13 }}>
          <tbody>
            <Total label="Subtotal" value={money(invoice.subtotal)} muted={muted} />
            {invoice.tax > 0 && <Total label="Tax" value={money(invoice.tax)} muted={muted} />}
            <tr>
              <td style={{ padding: "10px 0 0", borderTop: `2px solid ${ink}`, fontSize: 14, fontWeight: 800 }}>Total</td>
              <td style={{ padding: "10px 0 0", borderTop: `2px solid ${ink}`, fontSize: 17, fontWeight: 800, textAlign: "right" }}>
                {money(invoice.total)}
              </td>
            </tr>
            {paid > 0 && <Total label="Amount paid" value={`− ${money(paid)}`} muted={muted} top />}
            {paid > 0 && (
              <tr>
                <td style={{ padding: "8px 0 0", fontSize: 13, fontWeight: 800, color: balance > 0.005 ? "#B4232A" : "#0F7A4A" }}>
                  {balance > 0.005 ? "Balance due" : "Paid in full"}
                </td>
                <td style={{ padding: "8px 0 0", fontSize: 15, fontWeight: 800, textAlign: "right", color: balance > 0.005 ? "#B4232A" : "#0F7A4A" }}>
                  {money(balance)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* ---- Notes ---------------------------------------------------------- */}
      {invoice.notes && (
        <section style={{ marginTop: 26, padding: 14, background: "#F7F9FC", border: `1px solid ${line}`, borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: muted }}>NOTES</div>
          <div style={{ marginTop: 5, fontSize: 12.5, whiteSpace: "pre-wrap" }}>{invoice.notes}</div>
        </section>
      )}

      {/* ---- Footer: terms + thank-you -------------------------------------- */}
      <footer style={{ marginTop: 30, paddingTop: 16, borderTop: `1px solid ${line}` }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: muted }}>TERMS</div>
        <div style={{ marginTop: 5, fontSize: 11.5, color: muted, lineHeight: 1.6 }}>
          Payment is due by the date shown above. Please include the invoice number with your payment.
          Vehicles are serviced with care; pre-existing damage is documented before work begins.
        </div>
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, fontWeight: 700 }}>
          Thank you for your business.
        </div>
        <div style={{ marginTop: 3, textAlign: "center", fontSize: 11, color: muted }}>
          {biz.name}{biz.phone ? ` · ${biz.phone}` : ""}{biz.email ? ` · ${biz.email}` : ""}
        </div>
      </footer>
    </div>,
    document.body
  );
}

const th = (muted: string, line: string, align: "left" | "right"): React.CSSProperties => ({
  textAlign: align, padding: "0 0 8px", fontSize: 10, fontWeight: 800,
  letterSpacing: "0.09em", color: muted, borderBottom: `1px solid ${line}`,
});
const td = (line: string): React.CSSProperties => ({
  padding: "10px 0", borderBottom: `1px solid ${line}`, fontSize: 12.5, verticalAlign: "top",
});

function Total({ label, value, muted, top }: { label: string; value: string; muted: string; top?: boolean }) {
  return (
    <tr>
      <td style={{ padding: top ? "10px 0 0" : "5px 0", color: muted, fontSize: 12.5 }}>{label}</td>
      <td style={{ padding: top ? "10px 0 0" : "5px 0", textAlign: "right", fontWeight: 600 }}>{value}</td>
    </tr>
  );
}

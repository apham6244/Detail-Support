/**
 * Canonical metric tokens + helpers — the single source of truth for the
 * analytics/dashboard family (Analytics, Performance, Dashboard, Invoices,
 * Customers, Reviews, Leads). These used to be copy-pasted into each page,
 * which is exactly how "every page feels slightly different" happens. Import
 * from here instead of re-declaring.
 */

/** The four accent tones every metric surface shares. One shape, everywhere. */
export type Tone = "green" | "blue" | "purple" | "orange";

export const TONE: Record<Tone, { hex: string; text: string; bubble: string; glow: string }> = {
  green:  { hex: "#17A867", text: "text-success",   bubble: "bg-success/12 text-success",     glow: "bg-success/20" },
  blue:   { hex: "#2E7BFF", text: "text-brand-500", bubble: "bg-brand-500/12 text-brand-500", glow: "bg-brand-500/20" },
  purple: { hex: "#7A5BE0", text: "text-violet",    bubble: "bg-violet/12 text-violet",       glow: "bg-violet/20" },
  orange: { hex: "#E08A00", text: "text-warning",   bubble: "bg-warning/12 text-warning",     glow: "bg-warning/20" },
};

/** Shared recharts axis colour so every chart's gridlines/ticks match. */
export const AXIS = "#7E8AA3";

export type Point = { label: string; value: number };

/** The last `n` calendar months as { key: "YYYY-MM", label: "Mon" }, oldest first. */
export function lastMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }
  return out;
}

export const monthKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Money actually collected on an invoice (paid → total, deposit → deposit). */
export const collected = (inv: { status: string; total: number; deposit_amount: number }): number =>
  inv.status === "paid" ? inv.total : inv.status === "deposit_paid" ? inv.deposit_amount : 0;

/** Month-over-month % change from the last two points of a series. */
export const pctDelta = (s: Point[]): number => {
  const cur = s[s.length - 1]?.value ?? 0;
  const prev = s[s.length - 2]?.value ?? 0;
  if (prev > 0) return ((cur - prev) / prev) * 100;
  return cur > 0 ? 100 : 0;
};

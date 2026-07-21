import type { Appointment, Customer } from "./models";

export type SegmentKey = "all" | "new_30" | "repeat" | "lapsed_90";

export const SEGMENTS: { key: SegmentKey; label: string; description: string }[] = [
  { key: "all", label: "All customers", description: "Everyone in your customer list." },
  { key: "new_30", label: "New customers", description: "Added in the last 30 days." },
  { key: "repeat", label: "Repeat customers", description: "Two or more visits." },
  { key: "lapsed_90", label: "Lapsed customers", description: "No visit in 90+ days." },
];

export const segmentLabel = (key: string) => SEGMENTS.find((s) => s.key === key)?.label ?? key;

const DAY = 86_400_000;

/**
 * Segments are computed live from real customer + appointment data, so a
 * campaign always targets the current list rather than a stale snapshot.
 */
export function customersInSegment(
  key: SegmentKey,
  customers: Customer[],
  appointments: Appointment[]
): Customer[] {
  const now = Date.now();

  // last visit + visit count per customer
  const visits = new Map<string, { count: number; last: number | null }>();
  for (const a of appointments) {
    const t = new Date(a.scheduled_at).getTime();
    const v = visits.get(a.customer_id) ?? { count: 0, last: null };
    v.count += 1;
    v.last = v.last === null ? t : Math.max(v.last, t);
    visits.set(a.customer_id, v);
  }

  switch (key) {
    case "new_30":
      return customers.filter((c) => now - new Date(c.created_at).getTime() <= 30 * DAY);
    case "repeat":
      return customers.filter((c) => (visits.get(c.id)?.count ?? 0) >= 2);
    case "lapsed_90":
      return customers.filter((c) => {
        const v = visits.get(c.id);
        if (v?.last) return now - v.last > 90 * DAY;
        // never visited — lapsed only if they've been on the books a while
        return now - new Date(c.created_at).getTime() > 90 * DAY;
      });
    case "all":
    default:
      return customers;
  }
}

/** Fill [Customer Name] / [Business Name] placeholders. */
export function renderMessage(message: string, customerName: string, businessName: string): string {
  return message
    .replace(/\[Customer Name\]/g, customerName)
    .replace(/\[First Name\]/g, customerName.split(" ")[0] ?? customerName)
    .replace(/\[Business Name\]/g, businessName);
}

/** Recipients that can actually be contacted by the chosen channel. */
export function reachable(list: Customer[], channel: string): Customer[] {
  return channel === "sms" ? list.filter((c) => c.phone) : list.filter((c) => c.email);
}

export function toCsv(list: Customer[]): string {
  const rows = [["Name", "Email", "Phone"], ...list.map((c) => [c.name, c.email ?? "", c.phone ?? ""])];
  return rows.map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",")).join("\n");
}

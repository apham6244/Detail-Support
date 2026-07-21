/**
 * Segment rules, evaluated server-side at send time.
 *
 * The browser previews segments with the same rules (src/lib/segments.ts), but
 * a preview is only ever a hint: what actually gets sent is recomputed here
 * from current customer + appointment data, through the caller's RLS-scoped
 * client. So a campaign drafted last week targets today's list, and a client
 * can't hand us a recipient list of its own choosing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SegmentKey = "all" | "new_30" | "repeat" | "lapsed_90";
export const SEGMENT_KEYS: SegmentKey[] = ["all", "new_30", "repeat", "lapsed_90"];

export interface SegmentCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

const DAY = 86_400_000;

export async function resolveSegment(
  db: SupabaseClient,
  orgId: string,
  segment: SegmentKey
): Promise<SegmentCustomer[]> {
  const [{ data: customers }, { data: appts }] = await Promise.all([
    db.from("customers").select("id, name, email, phone, created_at").eq("org_id", orgId),
    db.from("appointments").select("customer_id, scheduled_at").eq("org_id", orgId),
  ]);

  const rows = (customers ?? []) as (SegmentCustomer & { created_at: string })[];
  const now = Date.now();

  // visit count + most recent visit per customer
  const visits = new Map<string, { count: number; last: number | null }>();
  for (const a of (appts ?? []) as { customer_id: string; scheduled_at: string }[]) {
    const t = new Date(a.scheduled_at).getTime();
    const v = visits.get(a.customer_id) ?? { count: 0, last: null };
    v.count += 1;
    v.last = v.last === null ? t : Math.max(v.last, t);
    visits.set(a.customer_id, v);
  }

  const picked = rows.filter((c) => {
    switch (segment) {
      case "new_30":
        return now - new Date(c.created_at).getTime() <= 30 * DAY;
      case "repeat":
        return (visits.get(c.id)?.count ?? 0) >= 2;
      case "lapsed_90": {
        const v = visits.get(c.id);
        if (v?.last) return now - v.last > 90 * DAY;
        return now - new Date(c.created_at).getTime() > 90 * DAY;
      }
      case "all":
      default:
        return true;
    }
  });

  return picked.map(({ id, name, email, phone }) => ({ id, name, email, phone }));
}

/** Fill the same placeholders the composer offers. */
export function renderMessage(message: string, customerName: string, businessName: string): string {
  return message
    .replace(/\[Customer Name\]/g, customerName)
    .replace(/\[First Name\]/g, customerName.split(" ")[0] ?? customerName)
    .replace(/\[Business Name\]/g, businessName);
}

/** Only people we can actually reach on the chosen channel. */
export function reachable(list: SegmentCustomer[], channel: string): SegmentCustomer[] {
  return channel === "sms" ? list.filter((c) => c.phone) : list.filter((c) => c.email);
}

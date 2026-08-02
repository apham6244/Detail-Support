import { useMemo } from "react";
import { AlertCircle, Clock, Send, BellRing, type LucideIcon } from "lucide-react";
import { money } from "@/components/ui/data";
import { useAuth } from "@/lib/auth";
import { useInvoices } from "./useInvoices";
import { useAppointments } from "./useAppointments";

export interface Notification {
  key: string;
  tone: "danger" | "warning" | "brand" | "violet";
  icon: LucideIcon;
  title: string;
  detail: string;
  to: string;
  count: number;
}

/**
 * The real alerts behind the top-bar bell — the same money-costing signals the
 * dashboard surfaces (overdue/unsent invoices, unconfirmed jobs today, lapsed
 * clients), derived from live data so the badge means something and clears
 * itself when the work is done.
 */
export function useNotifications(): { items: Notification[]; count: number } {
  const { role } = useAuth();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const showMoney = role !== "employee";

  return useMemo(() => {
    const now = Date.now();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const startTomorrow = startToday.getTime() + 86_400_000;

    const collected = (inv: (typeof invoices)[number]) =>
      inv.status === "paid" ? inv.total : inv.status === "deposit_paid" ? inv.deposit_amount : 0;
    const balanceOf = (inv: (typeof invoices)[number]) => Math.max(0, inv.total - collected(inv));

    let overdueCount = 0, overdueAmount = 0, unsentCount = 0;
    for (const inv of invoices) {
      const bal = balanceOf(inv);
      if (bal <= 0.005) continue;
      if (inv.due_at && new Date(inv.due_at).getTime() < now) { overdueCount += 1; overdueAmount += bal; }
      if (!inv.sent_at) unsentCount += 1;
    }

    const unconfirmedToday = appointments.filter((a) => {
      const t = new Date(a.scheduled_at).getTime();
      return t >= startToday.getTime() && t < startTomorrow && a.status === "scheduled";
    }).length;

    const lastDone: Record<string, number> = {};
    const upcoming = new Set<string>();
    for (const a of appointments) {
      const t = new Date(a.scheduled_at).getTime();
      if (a.status === "completed") lastDone[a.customer_id] = Math.max(lastDone[a.customer_id] ?? 0, t);
      if ((a.status === "scheduled" || a.status === "confirmed") && t >= now) upcoming.add(a.customer_id);
    }
    const lapsedCount = Object.entries(lastDone).filter(([id, t]) => !upcoming.has(id) && now - t > 60 * 86_400_000).length;

    const items: Notification[] = [];
    if (showMoney && overdueCount > 0)
      items.push({ key: "overdue", tone: "danger", icon: AlertCircle, title: `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`, detail: `${money(overdueAmount)} past due — chase payment`, to: "/invoices", count: overdueCount });
    if (unconfirmedToday > 0)
      items.push({ key: "unconfirmed", tone: "warning", icon: Clock, title: `${unconfirmedToday} job${unconfirmedToday === 1 ? "" : "s"} unconfirmed`, detail: "On today's board — confirm to avoid no-shows", to: "/appointments", count: unconfirmedToday });
    if (showMoney && unsentCount > 0)
      items.push({ key: "unsent", tone: "brand", icon: Send, title: `${unsentCount} invoice${unsentCount === 1 ? "" : "s"} not sent`, detail: "Completed work that hasn't been billed", to: "/invoices", count: unsentCount });
    if (lapsedCount > 0)
      items.push({ key: "lapsed", tone: "violet", icon: BellRing, title: `${lapsedCount} client${lapsedCount === 1 ? "" : "s"} gone quiet`, detail: "No visit in 60+ days — win them back", to: "/customers", count: lapsedCount });

    return { items, count: items.reduce((s, i) => s + i.count, 0) };
  }, [invoices, appointments, showMoney]);
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/lib/models";
import { isDemo, demoGuard, DEMO_INVOICES } from "@/lib/demo";

export type NewInvoice = {
  customer_id: string;
  vehicle_id?: string | null;
  deposit_amount?: number;
  tax?: number;
  notes?: string | null;
  internal_notes?: string | null;
  due_at?: string | null;
  lines: Omit<InvoiceLineItem, "id" | "amount">[];
};

/**
 * `vehicle_id` / `internal_notes` ship in migration 029. We write them
 * best-effort in a follow-up call and swallow a "column does not exist" error,
 * so invoice creation keeps working before 029 is applied.
 */
const isMissingInvoiceExtra = (msg: string) => /vehicle_id|internal_notes/i.test(msg);

const mapInvoice = (i: any): Invoice => ({
  ...i,
  subtotal: Number(i.subtotal ?? 0),
  tax: Number(i.tax ?? 0),
  total: Number(i.total ?? 0),
  deposit_amount: Number(i.deposit_amount ?? 0),
});

export function useInvoices() {
  const { org } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>(isDemo() ? DEMO_INVOICES : []);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) return; // demo never touches the database
    if (!supabase || !org) {
      setInvoices([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*, customer:customers(name)")
      .order("created_at", { ascending: false });
    setInvoices((data ?? []).map(mapInvoice));
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: NewInvoice) => {
    demoGuard();
    if (!supabase || !org) throw new Error("Sign in to create invoices.");

    const lines = input.lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        ...l,
        quantity: Number(l.quantity) || 1,
        unit_price: Number(l.unit_price) || 0,
        amount: (Number(l.quantity) || 1) * (Number(l.unit_price) || 0),
      }));
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const tax = Number(input.tax) || 0;
    const total = subtotal + tax;
    const deposit = Number(input.deposit_amount) || 0;

    // Simple per-org invoice number.
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true });
    const number = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

    // Payment status follows the money: fully covered → paid, part paid →
    // deposit_paid, nothing yet → unpaid. (No manual status needed.)
    const status: InvoiceStatus = total > 0 && deposit >= total ? "paid" : deposit > 0 ? "deposit_paid" : "unpaid";

    let { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        org_id: org.id,
        customer_id: input.customer_id,
        number,
        status,
        subtotal,
        tax,
        total,
        deposit_amount: deposit,
        notes: input.notes ?? null,
        due_at: input.due_at ?? null,
      })
      .select("*, customer:customers(name)")
      .single();
    if (error) throw new Error(error.message);

    if (lines.length) {
      const { error: liErr } = await supabase.from("invoice_line_items").insert(
        lines.map((l) => ({ org_id: org.id, invoice_id: inv.id, ...l }))
      );
      if (liErr) throw new Error(liErr.message);
    }

    // Best-effort: persist vehicle_id + internal_notes (migration 029).
    const extra: Record<string, unknown> = {};
    if (input.vehicle_id) extra.vehicle_id = input.vehicle_id;
    if (input.internal_notes != null && input.internal_notes !== "") extra.internal_notes = input.internal_notes;
    if (Object.keys(extra).length) {
      const res = await supabase.from("invoices").update(extra).eq("id", inv.id).select("*, customer:customers(name)").single();
      if (!res.error) inv = res.data;
      else if (!isMissingInvoiceExtra(res.error.message)) throw new Error(res.error.message);
    }

    const mapped = mapInvoice(inv);
    setInvoices((x) => [mapped, ...x]);
    return mapped;
  };

  const setStatus = async (id: string, status: InvoiceStatus) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", id)
      .select("*, customer:customers(name)")
      .single();
    if (error) throw new Error(error.message);
    setInvoices((x) => x.map((i) => (i.id === id ? mapInvoice(data) : i)));
  };

  const markSent = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("invoices")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, customer:customers(name)")
      .single();
    if (error) throw new Error(error.message);
    setInvoices((x) => x.map((i) => (i.id === id ? mapInvoice(data) : i)));
  };

  /** Line items for one invoice — loaded on demand (the list view doesn't need them). */
  const getLineItems = async (invoiceId: string): Promise<InvoiceLineItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase
      .from("invoice_line_items")
      .select("id, description, quantity, unit_price, amount")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });
    return (data ?? []).map((l: any) => ({
      ...l,
      quantity: Number(l.quantity ?? 1),
      unit_price: Number(l.unit_price ?? 0),
      amount: Number(l.amount ?? 0),
    }));
  };

  const remove = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const prev = invoices; // snapshot for rollback
    setInvoices((x) => x.filter((i) => i.id !== id)); // optimistic: gone instantly
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { setInvoices(prev); throw new Error(error.message); }
  };

  return { invoices, loading, ready: Boolean(org), reload: load, create, setStatus, markSent, remove, getLineItems };
}

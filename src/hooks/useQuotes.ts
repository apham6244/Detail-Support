import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Quote, QuoteLineItem, QuoteStatus } from "@/lib/models";

export type QuoteLineInput = Omit<QuoteLineItem, "id" | "amount">;

export type QuoteInput = {
  customer_id: string;
  vehicle_id?: string | null;
  discount?: number;
  tax?: number;
  notes?: string | null;
  /** Private staff-only note (migration 028). Written best-effort. */
  internal_notes?: string | null;
  valid_until?: string | null;
  lines: QuoteLineInput[];
};

/**
 * `internal_notes` ships in migration 028. To keep quote create/edit working on
 * databases that haven't applied it yet, we write it best-effort in a follow-up
 * call and swallow a "column does not exist" error. Once 028 is applied it just
 * works (and `select("*")` starts returning it).
 */
const isMissingInternalNotes = (msg: string) => /internal_notes/i.test(msg);

const SELECT = "*, customer:customers(name), vehicle:vehicles(year, make, model)";

const mapQuote = (q: any): Quote => ({
  ...q,
  subtotal: Number(q.subtotal ?? 0),
  discount: Number(q.discount ?? 0),
  tax: Number(q.tax ?? 0),
  total: Number(q.total ?? 0),
});

function totals(input: QuoteInput) {
  const lines = input.lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      service_id: l.service_id ?? null,
      description: l.description,
      quantity: Number(l.quantity) || 1,
      unit_price: Number(l.unit_price) || 0,
      amount: (Number(l.quantity) || 1) * (Number(l.unit_price) || 0),
    }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discount = Number(input.discount) || 0;
  const tax = Number(input.tax) || 0;
  const total = subtotal - discount + tax;
  return { lines, subtotal, discount, tax, total };
}

export function useQuotes() {
  const { org } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !org) {
      setQuotes([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("quotes").select(SELECT).order("created_at", { ascending: false });
    setQuotes((data ?? []).map(mapQuote));
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: QuoteInput) => {
    if (!supabase || !org) throw new Error("Sign in to create quotes.");
    const { lines, subtotal, discount, tax, total } = totals(input);

    const { count } = await supabase.from("quotes").select("id", { count: "exact", head: true });
    const number = `QUO-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: quote, error } = await supabase
      .from("quotes")
      .insert({
        org_id: org.id,
        customer_id: input.customer_id,
        vehicle_id: input.vehicle_id ?? null,
        number,
        status: "draft",
        subtotal,
        discount,
        tax,
        total,
        notes: input.notes ?? null,
        valid_until: input.valid_until ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);

    if (lines.length) {
      const { error: liErr } = await supabase
        .from("quote_line_items")
        .insert(lines.map((l) => ({ org_id: org.id, quote_id: quote.id, ...l })));
      if (liErr) throw new Error(liErr.message);
    }

    let finalQuote = quote;
    if (input.internal_notes != null && input.internal_notes !== "") {
      const res = await supabase
        .from("quotes")
        .update({ internal_notes: input.internal_notes })
        .eq("id", quote.id)
        .select(SELECT)
        .single();
      if (!res.error) finalQuote = res.data;
      else if (!isMissingInternalNotes(res.error.message)) throw new Error(res.error.message);
    }

    const mapped = mapQuote(finalQuote);
    setQuotes((x) => [mapped, ...x]);
    return mapped;
  };

  const update = async (id: string, input: QuoteInput) => {
    if (!supabase || !org) throw new Error("Not available.");
    const { lines, subtotal, discount, tax, total } = totals(input);

    const { data: quote, error } = await supabase
      .from("quotes")
      .update({
        customer_id: input.customer_id,
        vehicle_id: input.vehicle_id ?? null,
        subtotal,
        discount,
        tax,
        total,
        notes: input.notes ?? null,
        valid_until: input.valid_until ?? null,
      })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);

    // Replace line items.
    await supabase.from("quote_line_items").delete().eq("quote_id", id);
    if (lines.length) {
      const { error: liErr } = await supabase
        .from("quote_line_items")
        .insert(lines.map((l) => ({ org_id: org.id, quote_id: id, ...l })));
      if (liErr) throw new Error(liErr.message);
    }

    let finalQuote = quote;
    if (input.internal_notes !== undefined) {
      const res = await supabase
        .from("quotes")
        .update({ internal_notes: input.internal_notes || null })
        .eq("id", id)
        .select(SELECT)
        .single();
      if (!res.error) finalQuote = res.data;
      else if (!isMissingInternalNotes(res.error.message)) throw new Error(res.error.message);
    }

    const mapped = mapQuote(finalQuote);
    setQuotes((x) => x.map((q) => (q.id === id ? mapped : q)));
    return mapped;
  };

  const loadLines = async (quoteId: string): Promise<QuoteLineItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase
      .from("quote_line_items")
      .select("id, service_id, description, quantity, unit_price, amount")
      .eq("quote_id", quoteId)
      .order("created_at");
    return (data ?? []).map((l: any) => ({
      ...l,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      amount: Number(l.amount),
    }));
  };

  const setStatus = async (id: string, status: QuoteStatus) => {
    if (!supabase) throw new Error("Not available.");
    const patch: Record<string, unknown> = { status };
    const now = new Date().toISOString();
    if (status === "sent") patch.sent_at = now;
    if (status === "accepted") patch.accepted_at = now;
    if (status === "declined") patch.declined_at = now;
    const { data, error } = await supabase.from("quotes").update(patch).eq("id", id).select(SELECT).single();
    if (error) throw new Error(error.message);
    setQuotes((x) => x.map((q) => (q.id === id ? mapQuote(data) : q)));
    return mapQuote(data);
  };

  const remove = async (id: string) => {
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setQuotes((x) => x.filter((q) => q.id !== id));
  };

  const convertToInvoice = async (id: string) => {
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase.rpc("convert_quote_to_invoice", { p_quote: id });
    if (error) throw new Error(error.message);
    await load();
    return data as string; // invoice id
  };

  const convertToAppointment = async (id: string, scheduledAt: string, durationMin: number) => {
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase.rpc("convert_quote_to_appointment", {
      p_quote: id,
      p_scheduled_at: scheduledAt,
      p_duration: durationMin,
    });
    if (error) throw new Error(error.message);
    await load();
    return data as string; // appointment id
  };

  return {
    quotes,
    loading,
    ready: Boolean(org),
    reload: load,
    create,
    update,
    loadLines,
    setStatus,
    remove,
    convertToInvoice,
    convertToAppointment,
  };
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Customer } from "@/lib/models";
import { isDemo, demoGuard, DEMO_CUSTOMERS } from "@/lib/demo";

export type CustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  referral_source?: string | null;
};

/**
 * `referral_source` ships in migration 027. To keep customer create/edit working
 * on databases that haven't applied it yet, we write it best-effort in a second
 * call and swallow a "column does not exist" error rather than failing the whole
 * save. Once 027 is applied it just works.
 */
const isMissingColumn = (msg: string) =>
  /column .*referral_source.* does not exist/i.test(msg) || /referral_source/i.test(msg);

export function useCustomers() {
  const { org } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>(isDemo() ? DEMO_CUSTOMERS : []);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) return; // demo never touches the database
    if (!supabase || !org) {
      setCustomers([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: CustomerInput) => {
    demoGuard();
    if (!supabase || !org) throw new Error("Sign in to add customers.");
    const { referral_source, ...core } = input;
    let { data, error } = await supabase
      .from("customers")
      .insert({ org_id: org.id, ...core })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // Persist referral_source best-effort (see note on isMissingColumn).
    if (referral_source != null && referral_source !== "") {
      const res = await supabase
        .from("customers")
        .update({ referral_source })
        .eq("id", (data as Customer).id)
        .select("*")
        .single();
      if (!res.error) data = res.data;
      else if (!isMissingColumn(res.error.message)) throw new Error(res.error.message);
    }
    setCustomers((c) => [data as Customer, ...c]);
    return data as Customer;
  };

  const update = async (id: string, patch: Partial<CustomerInput>) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { referral_source, ...core } = patch;
    let current: Customer | null = null;
    if (Object.keys(core).length) {
      const { data, error } = await supabase
        .from("customers")
        .update(core)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      current = data as Customer;
    }
    if (referral_source !== undefined) {
      const res = await supabase
        .from("customers")
        .update({ referral_source })
        .eq("id", id)
        .select("*")
        .single();
      if (!res.error) current = res.data as Customer;
      else if (!isMissingColumn(res.error.message)) throw new Error(res.error.message);
    }
    if (current) setCustomers((c) => c.map((x) => (x.id === id ? current! : x)));
    return current;
  };

  const remove = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const prev = customers; // snapshot for rollback
    setCustomers((c) => c.filter((x) => x.id !== id)); // optimistic
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { setCustomers(prev); throw new Error(error.message); }
  };

  return { customers, loading, ready: Boolean(org), reload: load, create, update, remove };
}

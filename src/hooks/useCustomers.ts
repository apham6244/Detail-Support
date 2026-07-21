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
};

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
    const { data, error } = await supabase
      .from("customers")
      .insert({ org_id: org.id, ...input })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setCustomers((c) => [data as Customer, ...c]);
    return data as Customer;
  };

  const update = async (id: string, patch: Partial<CustomerInput>) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setCustomers((c) => c.map((x) => (x.id === id ? (data as Customer) : x)));
    return data as Customer;
  };

  const remove = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setCustomers((c) => c.filter((x) => x.id !== id));
  };

  return { customers, loading, ready: Boolean(org), reload: load, create, update, remove };
}

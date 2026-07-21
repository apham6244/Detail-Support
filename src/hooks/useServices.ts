import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Service } from "@/lib/models";

export type ServiceInput = {
  name: string;
  description?: string | null;
  price?: number;
  duration_min?: number;
  category?: string | null;
  active?: boolean;
};

const mapService = (s: any): Service => ({ ...s, price: Number(s.price ?? 0) });

export function useServices() {
  const { org } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !org) {
      setServices([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("services")
      .select("*")
      .order("name", { ascending: true });
    setServices((data ?? []).map(mapService));
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: ServiceInput) => {
    if (!supabase || !org) throw new Error("Sign in to add services.");
    const { data, error } = await supabase
      .from("services")
      .insert({ org_id: org.id, ...input })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const svc = mapService(data);
    setServices((s) => [...s, svc].sort((a, b) => a.name.localeCompare(b.name)));
    return svc;
  };

  const update = async (id: string, patch: Partial<ServiceInput>) => {
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("services")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setServices((s) => s.map((x) => (x.id === id ? mapService(data) : x)));
    return mapService(data);
  };

  const remove = async (id: string) => {
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setServices((s) => s.filter((x) => x.id !== id));
  };

  return { services, loading, ready: Boolean(org), reload: load, create, update, remove };
}

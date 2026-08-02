import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Vehicle } from "@/lib/models";
import { isDemo, demoGuard, DEMO_VEHICLES } from "@/lib/demo";

export type VehicleInput = {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  license_plate?: string | null;
  vin?: string | null;
  notes?: string | null;
};

/** Vehicles for one customer. */
export function useVehicles(customerId: string | null) {
  const { org } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>(
    isDemo() ? DEMO_VEHICLES.filter((v) => v.customer_id === customerId) : []
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) {
      setVehicles(DEMO_VEHICLES.filter((v) => v.customer_id === customerId));
      return;
    }
    if (!supabase || !org || !customerId) {
      setVehicles([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    setVehicles((data ?? []) as Vehicle[]);
    setLoading(false);
  }, [org, customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: VehicleInput) => {
    demoGuard();
    if (!supabase || !org || !customerId) throw new Error("Select a customer first.");
    const { data, error } = await supabase
      .from("vehicles")
      .insert({ org_id: org.id, customer_id: customerId, ...input })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setVehicles((v) => [data as Vehicle, ...v]);
    return data as Vehicle;
  };

  const remove = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const prev = vehicles; // snapshot for rollback
    setVehicles((v) => v.filter((x) => x.id !== id)); // optimistic
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) { setVehicles(prev); throw new Error(error.message); }
  };

  return { vehicles, loading, reload: load, create, remove };
}

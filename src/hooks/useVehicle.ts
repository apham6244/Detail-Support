import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Vehicle } from "@/lib/models";
import { isDemo, demoGuard, DEMO_VEHICLES } from "@/lib/demo";
import type { VehicleInput } from "./useVehicles";

/**
 * One vehicle, by id. `useVehicles` is scoped per customer and can't fetch a
 * single record given only a vehicle id (which is all the /vehicles/:id route
 * has), so the Vehicle Profile page needs this focused loader. RLS still gates
 * the read; demo mode reads the in-memory dataset and never hits the network.
 */
export function useVehicle(id: string | null) {
  const { org } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(
    isDemo() ? DEMO_VEHICLES.find((v) => v.id === id) ?? null : null
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) {
      setVehicle(DEMO_VEHICLES.find((v) => v.id === id) ?? null);
      return;
    }
    if (!supabase || !org || !id) {
      setVehicle(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
    setVehicle((data as Vehicle) ?? null);
    setLoading(false);
  }, [org, id]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (input: VehicleInput) => {
    demoGuard();
    if (!supabase || !id) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("vehicles")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setVehicle(data as Vehicle);
    return data as Vehicle;
  };

  return { vehicle, loading, reload: load, update };
}

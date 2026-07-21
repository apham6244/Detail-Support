import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Appointment, AppointmentStatus } from "@/lib/models";
import { isDemo, demoGuard, DEMO_APPOINTMENTS } from "@/lib/demo";

export type AppointmentInput = {
  customer_id: string;
  vehicle_id?: string | null;
  service_id?: string | null;
  scheduled_at: string;
  duration_min?: number;
  status?: AppointmentStatus;
  price?: number | null;
  notes?: string | null;
};

const SELECT =
  "*, customer:customers(name), vehicle:vehicles(year, make, model), service:services(name)";

const mapAppt = (a: any): Appointment => ({
  ...a,
  price: a.price === null || a.price === undefined ? null : Number(a.price),
});

export function useAppointments() {
  const { org } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>(isDemo() ? DEMO_APPOINTMENTS : []);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) return; // demo never touches the database
    if (!supabase || !org) {
      setAppointments([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select(SELECT)
      .order("scheduled_at", { ascending: true });
    setAppointments((data ?? []).map(mapAppt));
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: AppointmentInput) => {
    demoGuard();
    if (!supabase || !org) throw new Error("Sign in to book appointments.");
    const { data, error } = await supabase
      .from("appointments")
      .insert({ org_id: org.id, ...input })
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    await load();
    return mapAppt(data);
  };

  /** Edit any field of a booked job (date/time, service, price, notes…). */
  const update = async (id: string, patch: Partial<AppointmentInput>) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    setAppointments((a) => a.map((x) => (x.id === id ? mapAppt(data) : x)));
    return mapAppt(data);
  };

  const setStatus = async (id: string, status: AppointmentStatus) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    setAppointments((a) => a.map((x) => (x.id === id ? mapAppt(data) : x)));
  };

  const remove = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setAppointments((a) => a.filter((x) => x.id !== id));
  };

  /** Assign / reassign a job (owner/admin) via the RPC; null unassigns. */
  const assign = async (id: string, userId: string | null) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.rpc("assign_appointment", { p_appt: id, p_user: userId });
    if (error) throw new Error(error.message);
    await load();
  };

  return { appointments, loading, ready: Boolean(org), reload: load, create, update, setStatus, remove, assign };
}

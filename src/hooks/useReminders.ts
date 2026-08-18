import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Reminder } from "@/lib/models";
import { isDemo, demoGuard } from "@/lib/demo";

export function useReminders() {
  const { org } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) {
      setReminders([]); // read-only preview makes no DB calls
      return;
    }
    if (!supabase || !org) {
      setReminders([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("appointment_reminders")
      .select("*")
      .eq("org_id", org.id)
      .order("remind_at", { ascending: true });
    setReminders((data ?? []) as Reminder[]);
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (appointmentId: string, remindAt: string, channel = "sms") => {
    demoGuard();
    if (!supabase || !org) throw new Error("Sign in first.");
    const { data, error } = await supabase
      .from("appointment_reminders")
      .insert({ org_id: org.id, appointment_id: appointmentId, remind_at: remindAt, channel })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setReminders((r) => [...r, data as Reminder].sort((a, b) => a.remind_at.localeCompare(b.remind_at)));
    return data as Reminder;
  };

  /**
   * Send now, through the API. The server pulls the customer's contact details
   * from the job itself and marks the reminder sent — the same path the
   * scheduler takes when it comes due.
   */
  const sendNow = async (id: string) => {
    demoGuard();
    const result = await api<{ channel: string; to: string; provider: string }>("/notify/reminder", {
      method: "POST",
      body: JSON.stringify({ reminderId: id }),
    });
    await load();
    return result;
  };

  /** Fallback when the API isn't reachable: just record that it went out. */
  const markSent = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("appointment_reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setReminders((r) => r.map((x) => (x.id === id ? (data as Reminder) : x)));
  };

  const remove = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.from("appointment_reminders").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setReminders((r) => r.filter((x) => x.id !== id));
  };

  const forAppointment = (appointmentId: string) => reminders.filter((r) => r.appointment_id === appointmentId);

  return { reminders, loading, ready: Boolean(org), reload: load, create, sendNow, markSent, remove, forAppointment };
}

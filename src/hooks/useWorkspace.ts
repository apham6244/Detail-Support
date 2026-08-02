import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isDemo, DEMO_WORKSPACE } from "@/lib/demo";

export interface WorkspaceSettings {
  owner_name?: string | null;
  phone?: string | null;
  business_email?: string | null;
  location?: string | null;
  selected_plan?: "free" | "pro" | "team";
  founding_member?: boolean;
  // --- Control-center settings (all persisted into the same jsonb, no migration) ---
  tagline?: string | null;
  tax_enabled?: boolean;
  tax_label?: string | null;
  tax_rate?: number | null;
  notif_new_booking?: boolean;
  notif_reminders?: boolean;
  notif_review_requests?: boolean;
  notif_payment?: boolean;
  notif_sms?: boolean;
  ai_recommendations?: boolean;
  ai_business_coach?: boolean;
  pay_deposit_pct?: number | null;
  pay_terms_days?: number | null;
  pay_footer?: string | null;
  cal_default_duration?: number | null;
  cal_week_start?: "sun" | "mon";
  cal_open?: string | null;
  cal_close?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  trial_ends_at: string | null;
  settings: WorkspaceSettings;
}

export function useWorkspace() {
  const { org } = useAuth();
  const [ws, setWs] = useState<Workspace | null>(isDemo() ? (DEMO_WORKSPACE as Workspace) : null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) return; // demo keeps its in-memory workspace
    if (!supabase || !org) {
      setWs(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("id, name, plan, trial_ends_at, settings")
      .eq("id", org.id)
      .maybeSingle();
    if (data) setWs({ ...(data as Workspace), settings: (data as any).settings ?? {} });
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  /** Update name and/or merge into settings jsonb. */
  const save = async (patch: { name?: string; settings?: Partial<WorkspaceSettings> }) => {
    if (!ws) throw new Error("No workspace loaded.");
    const merged = { ...ws.settings, ...(patch.settings ?? {}) };
    // Demo: reflect changes in-memory only, never hit the database.
    if (isDemo()) {
      const next = { ...ws, name: patch.name ?? ws.name, settings: merged };
      setWs(next);
      return next;
    }
    if (!supabase) throw new Error("No workspace loaded.");
    const { data, error } = await supabase
      .from("organizations")
      .update({ name: patch.name ?? ws.name, settings: merged })
      .eq("id", ws.id)
      .select("id, name, plan, trial_ends_at, settings")
      .single();
    if (error) throw new Error(error.message);
    setWs({ ...(data as Workspace), settings: (data as any).settings ?? {} });
    return data as Workspace;
  };

  return { ws, loading, ready: Boolean(org), reload: load, save };
}

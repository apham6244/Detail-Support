import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export interface WorkspaceSettings {
  owner_name?: string | null;
  phone?: string | null;
  business_email?: string | null;
  location?: string | null;
  selected_plan?: "free" | "pro" | "team";
  founding_member?: boolean;
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
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
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
    if (!supabase || !ws) throw new Error("No workspace loaded.");
    const merged = { ...ws.settings, ...(patch.settings ?? {}) };
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

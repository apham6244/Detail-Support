import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/models";

export interface OrgMember {
  user_id: string;
  name: string;
  role: Role;
}

/** Active members of the current org, for assignee dropdowns + name lookup. */
export function useMembers() {
  const { org } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !org) {
      setMembers([]);
      return;
    }
    setLoading(true);
    const { data: mem } = await supabase
      .from("memberships")
      .select("user_id, role")
      .eq("org_id", org.id)
      .eq("status", "active");
    const rows = (mem ?? []) as { user_id: string; role: Role }[];
    let profiles: { id: string; full_name: string | null; email: string | null }[] = [];
    if (rows.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", rows.map((r) => r.user_id));
      profiles = profs ?? [];
    }
    setMembers(
      rows.map((r) => {
        const p = profiles.find((x) => x.id === r.user_id);
        return { user_id: r.user_id, role: r.role, name: p?.full_name?.trim() || p?.email || "Member" };
      })
    );
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  return { members, byId, loading, reload: load };
}

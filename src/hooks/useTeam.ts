import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Invitation, Role, TeamMember } from "@/lib/models";

/** Build the shareable accept link for an invitation token. */
export function inviteLink(token: string): string {
  return `${window.location.origin}/accept-invite?token=${token}`;
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("uniq_pending_invite") || m.includes("duplicate key"))
    return "There's already a pending invitation for that email.";
  if (m.includes("row-level security") || m.includes("violates"))
    return "You don't have permission to do that.";
  return message;
}

export function useTeam() {
  const { org, user, role } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);

  const isOwner = role === "owner";
  const isAdmin = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    if (!supabase || !org) {
      setMembers([]);
      setInvitations([]);
      return;
    }
    setLoading(true);
    // memberships and profiles both FK to auth.users (not to each other), so
    // PostgREST can't embed profiles directly — fetch both and merge.
    const [{ data: mem }, invRes] = await Promise.all([
      supabase
        .from("memberships")
        .select("id, user_id, role, status, created_at")
        .eq("org_id", org.id)
        .order("created_at", { ascending: true }),
      // Only owner/admin can read invitations (RLS). Employees get an empty list.
      isAdmin
        ? supabase
            .from("invitations")
            .select("*")
            .eq("org_id", org.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Invitation[] }),
    ]);

    const rows = (mem ?? []) as Omit<TeamMember, "profile">[];
    const ids = rows.map((m) => m.user_id);
    let profiles: { id: string; full_name: string | null; email: string | null }[] = [];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      profiles = profs ?? [];
    }
    setMembers(
      rows.map((m) => ({
        ...m,
        profile: profiles.find((p) => p.id === m.user_id) ?? null,
      })) as TeamMember[]
    );
    setInvitations((invRes.data ?? []) as Invitation[]);
    setLoading(false);
  }, [org, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async (email: string, inviteRole: Role): Promise<Invitation> => {
    if (!supabase || !org || !user) throw new Error("Sign in first.");
    const { data, error } = await supabase
      .from("invitations")
      .insert({ org_id: org.id, email: email.trim(), role: inviteRole, invited_by: user.id })
      .select("*")
      .single();
    if (error) throw new Error(friendly(error.message));
    const inv = data as Invitation;
    setInvitations((x) => [inv, ...x]);
    return inv;
  };

  const resend = async (id: string): Promise<Invitation> => {
    if (!supabase) throw new Error("Not available.");
    const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("invitations")
      .update({ expires_at: expires, revoked_at: null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(friendly(error.message));
    const inv = data as Invitation;
    setInvitations((x) => x.map((i) => (i.id === id ? inv : i)));
    return inv;
  };

  const revoke = async (id: string) => {
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(friendly(error.message));
    setInvitations((x) => x.map((i) => (i.id === id ? (data as Invitation) : i)));
  };

  const deleteInvite = async (id: string) => {
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) throw new Error(friendly(error.message));
    setInvitations((x) => x.filter((i) => i.id !== id));
  };

  const changeRole = async (membershipId: string, newRole: Role) => {
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.rpc("set_member_role", {
      p_membership: membershipId,
      p_role: newRole,
    });
    if (error) throw new Error(friendly(error.message));
    await load();
  };

  const removeMember = async (membershipId: string) => {
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.rpc("remove_member", { p_membership: membershipId });
    if (error) throw new Error(friendly(error.message));
    await load();
  };

  const transferOwnership = async (membershipId: string) => {
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.rpc("transfer_ownership", { p_membership: membershipId });
    if (error) throw new Error(friendly(error.message));
    await load();
  };

  return {
    members,
    invitations,
    loading,
    ready: Boolean(org),
    isOwner,
    isAdmin,
    role,
    currentUserId: user?.id ?? null,
    reload: load,
    invite,
    resend,
    revoke,
    deleteInvite,
    changeRole,
    removeMember,
    transferOwnership,
  };
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { LEAD_STATUS_LABEL, type Lead, type LeadActivity, type LeadStatus } from "@/lib/models";
import { isDemo, demoGuard, DEMO_LEADS } from "@/lib/demo";

export type LeadInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  vehicle?: string | null;
  service?: string | null;
  estimated_value?: number | null;
  source?: string | null;
  status?: LeadStatus;
  notes?: string | null;
  last_contacted_at?: string | null;
};

const mapLead = (l: any): Lead => ({
  ...l,
  estimated_value: l.estimated_value === null || l.estimated_value === undefined ? null : Number(l.estimated_value),
});

export function useLeads() {
  const { org } = useAuth();
  const [leads, setLeads] = useState<Lead[]>(isDemo() ? DEMO_LEADS : []);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) return; // demo never touches the database
    if (!supabase || !org) {
      setLeads([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLeads((data ?? []).map(mapLead));
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  // Fire-and-forget activity log (best effort — never blocks the main action).
  const logActivity = async (leadId: string, type: string, body: string) => {
    if (!supabase || !org) return;
    await supabase.from("lead_activities").insert({ org_id: org.id, lead_id: leadId, type, body });
  };

  const create = async (input: LeadInput) => {
    demoGuard();
    if (!supabase || !org) throw new Error("Sign in to add leads.");
    const { data, error } = await supabase
      .from("leads")
      .insert({ org_id: org.id, ...input })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const mapped = mapLead(data);
    setLeads((l) => [mapped, ...l]);
    await logActivity(mapped.id, "created", "Lead created");
    return mapped;
  };

  const update = async (id: string, patch: Partial<LeadInput>) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setLeads((ls) => ls.map((x) => (x.id === id ? mapLead(data) : x)));
    return mapLead(data);
  };

  const setStatus = async (id: string, status: LeadStatus) => {
    demoGuard();
    const prev = leads.find((l) => l.id === id)?.status;
    const patch: Partial<LeadInput> = { status };
    if (status === "contacted") patch.last_contacted_at = new Date().toISOString();
    const res = await update(id, patch);
    if (prev && prev !== status) {
      await logActivity(id, "status_change", `Status changed from ${LEAD_STATUS_LABEL[prev]} to ${LEAD_STATUS_LABEL[status]}`);
    }
    return res;
  };

  const markContacted = async (id: string) => {
    demoGuard();
    const res = await update(id, { last_contacted_at: new Date().toISOString() });
    await logActivity(id, "contacted", "Marked as contacted");
    return res;
  };

  const remove = async (id: string) => {
    demoGuard();
    if (!supabase) throw new Error("Not available.");
    const prev = leads; // snapshot for rollback
    setLeads((ls) => ls.filter((x) => x.id !== id)); // optimistic
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { setLeads(prev); throw new Error(error.message); }
  };

  /**
   * Turn a lead into a customer without re-entering info: create the customer
   * from the lead's details, mark the lead Won + linked, and log it.
   * Returns the new customer id.
   */
  const convertToCustomer = async (lead: Lead) => {
    demoGuard();
    if (!supabase || !org) throw new Error("Not available.");
    const notesBits = [
      lead.vehicle ? `Vehicle: ${lead.vehicle}` : null,
      lead.service ? `Requested: ${lead.service}` : null,
      lead.notes ? lead.notes : null,
      "Converted from lead.",
    ].filter(Boolean);
    const { data: cust, error } = await supabase
      .from("customers")
      .insert({
        org_id: org.id,
        name: lead.name,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        notes: notesBits.join("\n"),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await update(lead.id, { status: "won" });
    // converted_customer_id isn't part of LeadInput — write it directly.
    await supabase.from("leads").update({ converted_customer_id: cust.id }).eq("id", lead.id);
    setLeads((ls) => ls.map((x) => (x.id === lead.id ? { ...x, status: "won", converted_customer_id: cust.id } : x)));
    await logActivity(lead.id, "converted", "Converted to customer");
    return cust.id as string;
  };

  return { leads, loading, ready: Boolean(org), reload: load, create, update, setStatus, markContacted, remove, convertToCustomer, logActivity };
}

/** Notes + activity timeline for one lead. */
export function useLeadActivities(leadId: string | null) {
  const { org } = useAuth();
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) return; // demo never touches the database
    if (!supabase || !org || !leadId) {
      setActivities([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setActivities((data ?? []) as LeadActivity[]);
    setLoading(false);
  }, [org, leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = async (body: string) => {
    demoGuard();
    if (!supabase || !org || !leadId) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("lead_activities")
      .insert({ org_id: org.id, lead_id: leadId, type: "note", body })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setActivities((a) => [data as LeadActivity, ...a]);
    return data as LeadActivity;
  };

  return { activities, loading, reload: load, addNote };
}

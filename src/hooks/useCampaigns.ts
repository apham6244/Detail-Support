import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campaign } from "@/lib/models";
import { isDemo, demoGuard } from "@/lib/demo";

export interface SendResult {
  channel: "email" | "sms";
  provider: string;
  audience: number;
  sent: number;
  failed: number;
  skipped: number;
}

export type CampaignInput = {
  name: string;
  segment: string;
  channel: string;
  subject?: string | null;
  message: string;
};

export function useCampaigns() {
  const { org } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isDemo()) {
      setCampaigns([]); // read-only preview makes no DB calls
      return;
    }
    if (!supabase || !org) {
      setCampaigns([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns((data ?? []) as Campaign[]);
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: CampaignInput) => {
    demoGuard();
    if (!supabase || !org) throw new Error("Sign in first.");
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .insert({ org_id: org.id, ...input, status: "draft" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const c = data as Campaign;
    setCampaigns((x) => [c, ...x]);
    return c;
  };

  const update = async (id: string, patch: Partial<CampaignInput>) => {
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase.from("marketing_campaigns").update(patch).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    setCampaigns((x) => x.map((c) => (c.id === id ? (data as Campaign) : c)));
    return data as Campaign;
  };

  /**
   * Bulk-send through the API. The server recomputes the segment from live
   * data and does the sending — we only pass the campaign id.
   */
  const send = async (id: string): Promise<SendResult> => {
    const result = await api<SendResult>("/notify/campaign", {
      method: "POST",
      body: JSON.stringify({ campaignId: id }),
    });
    await load();
    return result;
  };

  /** Fallback for when delivery isn't wired: just record that it went out. */
  const markSent = async (id: string, recipientCount: number) => {
    if (!supabase) throw new Error("Not available.");
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .update({ status: "sent", recipient_count: recipientCount, sent_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setCampaigns((x) => x.map((c) => (c.id === id ? (data as Campaign) : c)));
    return data as Campaign;
  };

  const remove = async (id: string) => {
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setCampaigns((x) => x.filter((c) => c.id !== id));
  };

  return { campaigns, loading, ready: Boolean(org), reload: load, create, update, send, markSent, remove };
}

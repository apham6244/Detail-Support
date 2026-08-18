import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isDemo } from "@/lib/demo";

export interface BillingConfig {
  /** Stripe can actually charge a card on this server. */
  configured: boolean;
  /** Test-mode keys — the UI says so rather than implying real charges. */
  testMode: boolean;
  /** plan → does it have a Stripe Price ID attached. */
  purchasable: Record<string, boolean>;
}

export interface StripeSubscription {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

/**
 * Billing state that lives outside the entitlements catalog: whether Stripe is
 * wired up on the server, and the Stripe-specific fields on this org's
 * subscription row.
 *
 * If the API is unreachable we report configured:false and the page falls back
 * to the pre-Stripe plan switcher — which the DB still allows precisely because
 * no Price ID is configured (see 024). The two stay consistent by construction.
 */
export function useBilling() {
  const { org } = useAuth();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [sub, setSub] = useState<StripeSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiReachable, setApiReachable] = useState(true);

  /** Returns the freshly-read subscription so callers can poll on it. */
  const load = useCallback(async (): Promise<StripeSubscription | null> => {
    if (isDemo()) {
      // Read-only preview: no API/DB calls. Billing runs on the manual switcher.
      setConfig({ configured: false, testMode: true, purchasable: {} });
      setSub(null);
      setApiReachable(false);
      setLoading(false);
      return null;
    }
    if (!org) {
      setConfig(null);
      setSub(null);
      setLoading(false);
      return null;
    }
    setLoading(true);

    try {
      const cfg = await api<BillingConfig>("/billing/status");
      setConfig(cfg);
      setApiReachable(true);
    } catch {
      // No API running (or not signed in yet) — treat billing as not configured.
      setConfig({ configured: false, testMode: true, purchasable: {} });
      setApiReachable(false);
    }

    let fresh: StripeSubscription | null = null;
    if (supabase) {
      const { data } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id, stripe_subscription_id, cancel_at_period_end, current_period_end")
        .eq("org_id", org.id)
        .maybeSingle();
      if (data) {
        const r = data as Record<string, unknown>;
        fresh = {
          stripeCustomerId: (r.stripe_customer_id as string) ?? null,
          stripeSubscriptionId: (r.stripe_subscription_id as string) ?? null,
          cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
          currentPeriodEnd: (r.current_period_end as string) ?? null,
        };
        setSub(fresh);
      }
    }
    setLoading(false);
    return fresh;
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  /** Send the owner to Stripe Checkout. Returns only on failure — otherwise we navigate away. */
  const checkout = async (plan: "pro" | "team") => {
    const { url } = await api<{ url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
    window.location.assign(url);
  };

  /** Send the owner to Stripe's billing portal to change cards, plans, or cancel. */
  const portal = async () => {
    const { url } = await api<{ url: string }>("/billing/portal", { method: "POST" });
    window.location.assign(url);
  };

  return {
    loading,
    apiReachable,
    /** True only when Stripe is live AND this plan has a Price ID. */
    canBuy: (plan: string) => Boolean(config?.configured && config.purchasable[plan]),
    stripeLive: Boolean(config?.configured),
    testMode: Boolean(config?.testMode),
    sub,
    reload: load,
    checkout,
    portal,
  };
}

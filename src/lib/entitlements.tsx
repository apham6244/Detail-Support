import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { isDemo } from "./demo";
import type { BillingPlan, BillingStatus } from "./models";

export interface PlanFeature {
  key: string;
  label: string;
}

export interface PlanInfo {
  plan: BillingPlan;
  name: string;
  monthlyPrice: number;
  seatLimit: number;
  customerLimit: number | null; // null = unlimited
  features: PlanFeature[];
  featureKeys: Set<string>;
}

interface EntitlementsValue {
  loading: boolean;
  ready: boolean;
  /** Plans in display order (free → pro → team), each with its features. */
  catalog: PlanInfo[];
  planInfo: (p: BillingPlan) => PlanInfo | undefined;

  subscriptionPlan: BillingPlan; // what they signed up / switched to
  effectivePlan: BillingPlan; // what's actually in force now (trial-aware)
  status: BillingStatus;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  foundingMember: boolean;
  monthlyPrice: number; // locked founding rate, else list price

  seatsUsed: number;
  seatLimit: number;
  customersUsed: number;
  customerLimit: number | null;

  /** True iff the org's EFFECTIVE plan includes this feature (mirrors the DB
   *  org_has_feature: same effective_plan + plan_features data). Server-side
   *  RLS + limit triggers remain the real security boundary. */
  hasFeature: (key: string) => boolean;
  /** Lowest tier that unlocks a feature (for upgrade prompts). */
  planForFeature: (key: string) => PlanInfo | undefined;

  changePlan: (p: BillingPlan) => Promise<void>;
  reload: () => Promise<void>;
}

const EntitlementsContext = createContext<EntitlementsValue | undefined>(undefined);

const daysLeft = (iso: string | null) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : null;

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { org } = useAuth();

  const [catalog, setCatalog] = useState<PlanInfo[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<BillingPlan>("free");
  const [effectivePlan, setEffectivePlan] = useState<BillingPlan>("free");
  const [status, setStatus] = useState<BillingStatus>("trialing");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [foundingMember, setFoundingMember] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [seatsUsed, setSeatsUsed] = useState(0);
  const [customersUsed, setCustomersUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Demo never queries the database — hasFeature() already returns true.
    if (isDemo() || !supabase || !org) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [catRes, subRes, epRes, priceRes, seatRes, custRes] = await Promise.all([
      supabase
        .from("plans")
        .select("plan, name, monthly_price, seat_limit, customer_limit, sort_order, plan_features(features(key, label, sort_order))")
        .order("sort_order"),
      supabase
        .from("subscriptions")
        .select("plan, status, trial_ends_at, founding_member")
        .eq("org_id", org.id)
        .maybeSingle(),
      supabase.rpc("effective_plan", { p_org: org.id }),
      supabase.rpc("org_monthly_price", { p_org: org.id }),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active"),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    ]);

    const cat: PlanInfo[] = ((catRes.data as any[]) ?? []).map((row) => {
      const feats: PlanFeature[] = (row.plan_features ?? [])
        .map((pf: any) => pf.features)
        .filter(Boolean)
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((f: any) => ({ key: f.key, label: f.label }));
      return {
        plan: row.plan as BillingPlan,
        name: row.name as string,
        monthlyPrice: Number(row.monthly_price),
        seatLimit: row.seat_limit as number,
        customerLimit: row.customer_limit as number | null,
        features: feats,
        featureKeys: new Set(feats.map((f) => f.key)),
      };
    });
    setCatalog(cat);

    if (subRes.data) {
      const s = subRes.data as any;
      setSubscriptionPlan(s.plan);
      setStatus(s.status);
      setTrialEndsAt(s.trial_ends_at);
      setFoundingMember(Boolean(s.founding_member));
    }
    setEffectivePlan(((epRes.data as string) ?? "free") as BillingPlan);
    setMonthlyPrice(Number(priceRes.data ?? 0));
    setSeatsUsed(seatRes.count ?? 0);
    setCustomersUsed(custRes.count ?? 0);
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const changePlan = useCallback(
    async (p: BillingPlan) => {
      if (!supabase || !org) throw new Error("Sign in first.");
      const { error } = await supabase.rpc("set_subscription_plan", { p_org: org.id, p_plan: p });
      if (error) throw new Error(error.message);
      await load();
    },
    [org, load]
  );

  const value = useMemo<EntitlementsValue>(() => {
    const byPlan = new Map(catalog.map((c) => [c.plan, c]));
    const eff = byPlan.get(effectivePlan);
    const seatLimit = byPlan.get(effectivePlan)?.seatLimit ?? 1;
    const customerLimit = byPlan.get(effectivePlan)?.customerLimit ?? null;

    return {
      loading,
      ready: Boolean(org) && catalog.length > 0,
      catalog,
      planInfo: (p) => byPlan.get(p),
      subscriptionPlan,
      effectivePlan,
      status,
      trialEndsAt,
      trialDaysLeft: status === "trialing" ? daysLeft(trialEndsAt) : null,
      foundingMember,
      monthlyPrice,
      seatsUsed,
      seatLimit,
      customersUsed,
      customerLimit,
      // In demo every feature is unlocked so a visitor sees the whole product
      // rather than a wall of upgrade prompts. Real orgs are unaffected.
      hasFeature: (key) => (isDemo() ? true : Boolean(eff?.featureKeys.has(key))),
      planForFeature: (key) => catalog.find((c) => c.featureKeys.has(key)),
      changePlan,
      reload: load,
    };
  }, [
    catalog,
    effectivePlan,
    subscriptionPlan,
    status,
    trialEndsAt,
    foundingMember,
    monthlyPrice,
    seatsUsed,
    customersUsed,
    loading,
    org,
    changePlan,
    load,
  ]);

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error("useEntitlements must be used within EntitlementsProvider");
  return ctx;
}

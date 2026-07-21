import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CreditCard,
  Check,
  Users,
  UserRound,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Lock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loading, SignInPrompt, EmptyState } from "@/components/ui/data";
import { useAuth } from "@/lib/auth";
import { useEntitlements, type PlanInfo } from "@/lib/entitlements";
import { useBilling } from "@/hooks/useBilling";
import { BILLING_STATUS_LABEL, type BillingPlan, type BillingStatus } from "@/lib/models";
import { cn } from "@/lib/cn";

const STATUS_BADGE: Record<BillingStatus, string> = {
  trialing: "bg-brand-500/10 text-brand-500",
  active: "bg-success/10 text-success",
  past_due: "bg-warning/10 text-warning",
  canceled: "bg-danger/10 text-danger",
};

const priceLabel = (n: number) => (n === 0 ? "$0" : `$${n}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Billing() {
  const { role } = useAuth();
  const ent = useEntitlements();
  const billing = useBilling();
  const [params, setParams] = useSearchParams();
  const [busyPlan, setBusyPlan] = useState<BillingPlan | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const handledReturn = useRef(false);

  const isOwner = role === "owner";

  // Coming back from Stripe Checkout. Stripe redirects the moment the payment
  // succeeds, but the webhook that actually activates the plan arrives
  // separately — so a naive page would greet a paying customer with "Free".
  // Wait for the subscription to land instead of guessing.
  useEffect(() => {
    const outcome = params.get("checkout");
    if (!outcome || handledReturn.current) return;
    handledReturn.current = true;

    const next = new URLSearchParams(params);
    next.delete("checkout");
    setParams(next, { replace: true });

    if (outcome === "cancelled") {
      setNotice({ kind: "warn", text: "Checkout cancelled — you haven't been charged." });
      return;
    }
    if (outcome !== "success") return;

    let stopped = false;
    setActivating(true);
    (async () => {
      for (let i = 0; i < 10 && !stopped; i++) {
        const fresh = await billing.reload();
        if (fresh?.stripeSubscriptionId) {
          await ent.reload();
          if (stopped) return;
          setActivating(false);
          setNotice({ kind: "ok", text: "Payment received — your plan is active. Thank you!" });
          return;
        }
        await sleep(1500);
      }
      if (stopped) return;
      setActivating(false);
      // Never claim it worked when we can't see it. This exact message is the
      // symptom of a webhook that isn't reaching this server.
      setNotice({
        kind: "warn",
        text:
          "Your payment went through, but we haven't seen the confirmation from Stripe yet. " +
          "It usually lands within a minute — refresh this page shortly. If it stays like this, " +
          "the Stripe webhook isn't reaching the server.",
      });
    })();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (role === "employee") {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Billing" subtitle="Plan &amp; usage" />
        <EmptyState
          art="key"
          title="Billing is for owners and admins"
          body="Plan and payment settings aren't available to Detailer accounts."
        />
      </div>
    );
  }

  if (ent.loading || !ent.ready) return ent.loading ? <Loading /> : <SignInPrompt what="billing" />;

  const current = ent.planInfo(ent.subscriptionPlan);
  const currentIndex = ent.catalog.findIndex((p) => p.plan === ent.subscriptionPlan);
  const trialExpired = ent.subscriptionPlan !== ent.effectivePlan;

  const selectPlan = async (target: PlanInfo) => {
    setNotice(null);
    if (ent.seatsUsed > target.seatLimit) {
      setNotice({
        kind: "warn",
        text: `You have ${ent.seatsUsed} team members, but ${target.name} allows ${target.seatLimit}. Remove teammates before switching to ${target.name}.`,
      });
      return;
    }
    if (target.customerLimit !== null && ent.customersUsed > target.customerLimit) {
      setNotice({
        kind: "warn",
        text: `You have ${ent.customersUsed} customers, but ${target.name} allows ${target.customerLimit}. You'd need to be under the limit to switch to ${target.name}.`,
      });
      return;
    }

    setBusyPlan(target.plan);
    try {
      // Already paying? Plan changes belong in the portal — a second Checkout
      // would open a SECOND subscription and bill them twice.
      if (billing.sub?.stripeSubscriptionId) {
        await billing.portal();
        return;
      }
      if (billing.canBuy(target.plan)) {
        await billing.checkout(target.plan as "pro" | "team");
        return; // navigating to Stripe
      }
      // No Stripe (or this plan has no Price ID): the DB still permits the
      // manual switch, because billing_is_live() is false. UI and database
      // agree here by construction rather than by us remembering to match them.
      await ent.changePlan(target.plan);
      setNotice({ kind: "ok", text: `You're now on the ${target.name} plan.` });
    } catch (e) {
      setNotice({ kind: "warn", text: (e as Error).message });
    } finally {
      setBusyPlan(null);
    }
  };

  const openPortal = async () => {
    setNotice(null);
    setPortalBusy(true);
    try {
      await billing.portal();
    } catch (e) {
      setNotice({ kind: "warn", text: (e as Error).message });
      setPortalBusy(false);
    }
  };

  const renews = billing.sub?.currentPeriodEnd
    ? new Date(billing.sub.currentPeriodEnd).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Billing" subtitle="Your plan, usage, and payments" />

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        {notice && (
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-[13px] font-medium",
              notice.kind === "ok"
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning"
            )}
          >
            {notice.text}
          </div>
        )}

        {activating && (
          <div className="flex items-center gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-[13px] font-medium text-brand-500">
            <Loader2 className="h-4 w-4 flex-none animate-spin" />
            Payment received — waiting for Stripe to confirm and activate your plan…
          </div>
        )}

        {billing.stripeLive && billing.testMode && (
          <div className="rounded-xl border border-line bg-panel2/60 px-4 py-3 text-[12.5px] text-ink3">
            <span className="font-semibold text-ink2">Stripe test mode.</span> Checkout works end to end, but
            no real money moves. Use card <span className="font-mono">4242 4242 4242 4242</span> with any
            future expiry and CVC.
          </div>
        )}

        {billing.sub?.cancelAtPeriodEnd && renews && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] font-medium text-warning">
            Your subscription is set to cancel on {renews}. You keep {current?.name ?? "your"} features until
            then, and you can resume any time from Manage billing.
          </div>
        )}

        {ent.status === "past_due" && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">
            We couldn't take your last payment, so your workspace is on Free limits right now. Update your card
            in Manage billing to restore {ent.planInfo(ent.subscriptionPlan)?.name}.
          </div>
        )}

        {trialExpired && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] font-medium text-warning">
            Your trial has ended, so your workspace is on Free limits. Choose a plan to restore{" "}
            {ent.planInfo(ent.subscriptionPlan)?.name} features.
          </div>
        )}

        {/* Current plan + usage */}
        <Panel title="Current plan">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-bold">{current?.name ?? "Free"}</span>
                  <span className="text-[13px] text-ink3">
                    {priceLabel(ent.monthlyPrice)}
                    {ent.monthlyPrice > 0 ? " /month" : ""}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", STATUS_BADGE[ent.status])}>
                    {BILLING_STATUS_LABEL[ent.status]}
                  </span>
                  {ent.foundingMember && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-2 py-0.5 text-[10.5px] font-semibold text-violet">
                      <Sparkles className="h-3 w-3" /> Founding member
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink3">
                  {/* Gate on the STATUS, not just the date: once Stripe starts
                      billing, trial_ends_at is kept as history, so checking the
                      date alone would keep saying "Trial — 1 day left" to
                      someone who is already being charged. */}
                  {ent.status === "trialing" && ent.trialDaysLeft !== null && ent.trialDaysLeft > 0
                    ? billing.sub?.stripeSubscriptionId
                      ? `Trial — ${ent.trialDaysLeft} day${ent.trialDaysLeft === 1 ? "" : "s"} left, then billing starts`
                      : `Trial — ${ent.trialDaysLeft} day${ent.trialDaysLeft === 1 ? "" : "s"} left`
                    : ent.foundingMember
                      ? "Founding rate locked in for life"
                      : "Manage your subscription below"}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Meter icon={<Users className="h-4 w-4" />} label="Team seats" used={ent.seatsUsed} limit={ent.seatLimit} unit="seat" />
              <Meter icon={<UserRound className="h-4 w-4" />} label="Customers" used={ent.customersUsed} limit={ent.customerLimit} unit="customer" />
            </div>
          </div>
        </Panel>

        {/* Plan chooser (from the database catalog) */}
        <Panel title="Change plan" subtitle={isOwner ? undefined : "Only the owner can change the plan"} className="border-t border-line pt-8">
            <div className="grid gap-3 sm:grid-cols-3">
              {ent.catalog.map((spec, i) => {
                const isCurrent = spec.plan === ent.subscriptionPlan;
                const direction = i > currentIndex ? "up" : "down";
                // A shop that is trialing (or lapsed) on its current plan still
                // needs a way to START paying. Showing a disabled "Current plan"
                // here would trap them: their own tier is the one plan they
                // can't check out, which is exactly the trial→paid conversion.
                const needsSubscribe =
                  isCurrent && !billing.sub?.stripeSubscriptionId && billing.canBuy(spec.plan);
                return (
                  <div
                    key={spec.plan}
                    className={cn(
                      "surface flex flex-col rounded-2xl p-4",
                      isCurrent && "border-brand-500/60 bg-brand-500/[0.06]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold">{spec.name}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-500">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-[20px] font-bold tnum">{priceLabel(spec.monthlyPrice)}</span>
                      <span className="text-[12px] text-ink3">{spec.monthlyPrice > 0 ? "/month" : "forever"}</span>
                    </div>
                    <div className="mt-2 text-[11px] font-medium text-ink3">
                      {spec.customerLimit === null ? "Unlimited customers" : `Up to ${spec.customerLimit} customers`}
                      {spec.seatLimit > 1 ? ` · up to ${spec.seatLimit} seats` : " · 1 seat"}
                    </div>
                    <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                      {spec.features.map((f) => (
                        <li key={f.key} className="flex items-start gap-1.5 text-[12px] text-ink2">
                          <Check className="mt-0.5 h-3 w-3 flex-none text-success" />
                          {f.label}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      {isCurrent && !needsSubscribe ? (
                        <button disabled className="h-9 w-full rounded-lg border border-line text-[12.5px] font-semibold text-ink3">
                          Current plan
                        </button>
                      ) : (
                        <button
                          onClick={() => selectPlan(spec)}
                          disabled={!isOwner || busyPlan !== null}
                          className={cn(
                            "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold transition disabled:opacity-50",
                            needsSubscribe || direction === "up"
                              ? "bg-brand-500 text-white hover:bg-brand-600"
                              : "border border-line text-ink2 hover:border-ink3"
                          )}
                        >
                          {busyPlan === spec.plan ? (
                            billing.canBuy(spec.plan) || billing.sub?.stripeSubscriptionId ? (
                              "Opening Stripe…"
                            ) : (
                              "Updating…"
                            )
                          ) : needsSubscribe ? (
                            <>
                              <CreditCard className="h-3.5 w-3.5" />
                              {ent.status === "trialing"
                                ? `Subscribe — ${priceLabel(spec.monthlyPrice)}/mo`
                                : `Reactivate — ${priceLabel(spec.monthlyPrice)}/mo`}
                            </>
                          ) : direction === "up" ? (
                            <>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              {billing.canBuy(spec.plan) && !billing.sub?.stripeSubscriptionId
                                ? `Upgrade — ${priceLabel(spec.monthlyPrice)}/mo`
                                : "Upgrade"}
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="h-3.5 w-3.5" /> Downgrade
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11.5px] text-ink3">
              {billing.sub?.stripeSubscriptionId
                ? "Changing plans opens Stripe, where the difference is prorated automatically."
                : billing.stripeLive
                  ? "Upgrading opens Stripe Checkout. Your plan activates as soon as the payment confirms."
                  : "Plan changes apply immediately. No card is charged — payments connect once Stripe is configured."}
              {ent.foundingMember ? " Your founding-member rate is locked in." : ""}
            </p>
        </Panel>

        {/* Payment method + history — Stripe's portal owns both, so we link to
            it rather than rebuilding (and re-storing) card data ourselves. */}
        <Panel title="Payment & invoices" className="border-t border-line pt-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-panel2 text-ink3">
                {billing.sub?.stripeCustomerId ? <Receipt className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">
                  {billing.sub?.stripeCustomerId
                    ? "Manage your card, invoices, and subscription"
                    : "No payment method on file"}
                </div>
                <div className="text-[12.5px] text-ink3">
                  {billing.sub?.stripeCustomerId
                    ? `Cards, receipts, and cancellation live in Stripe's secure portal.${renews && !billing.sub.cancelAtPeriodEnd ? ` Renews ${renews}.` : ""}`
                    : billing.stripeLive
                      ? "You'll add a card at checkout when you upgrade. We never see or store your card details."
                      : "Secure card payments powered by Stripe — not connected on this server yet."}
                </div>
              </div>
              {billing.sub?.stripeCustomerId && isOwner && (
                <button
                  onClick={openPortal}
                  disabled={portalBusy}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-4 text-[12.5px] font-semibold text-ink2 transition hover:border-ink3 disabled:opacity-50"
                >
                  {portalBusy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening…
                    </>
                  ) : (
                    <>
                      Manage billing <ExternalLink className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
        </Panel>

        <p className="pb-4 text-center text-[12px] text-ink3">
          Manage your workspace in <Link to="/settings" className="font-semibold text-brand-500">Settings</Link>.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** A borderless billing section: heading (+ optional subtitle), then content. */
function Panel({ title, subtitle, className, children }: {
  title: string; subtitle?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-3">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink3">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Meter({
  icon,
  label,
  used,
  limit,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number | null;
  unit: string;
}) {
  const unlimited = limit === null;
  const ratio = unlimited ? 0 : limit === 0 ? 1 : Math.min(1, used / limit);
  const atLimit = !unlimited && used >= (limit ?? 0);
  const near = !unlimited && !atLimit && ratio >= 0.8;
  const barColor = unlimited ? "bg-brand-500/40" : atLimit ? "bg-danger" : near ? "bg-warning" : "bg-brand-500";

  return (
    <div className="rounded-xl bg-panel2/50 p-3.5">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-ink3">
        {icon}
        {label}
      </div>
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="text-[20px] font-bold tnum">{used}</span>
        <span className="text-[13px] text-ink3">/ {unlimited ? "Unlimited" : limit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line2">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: unlimited ? "100%" : `${Math.max(4, ratio * 100)}%` }} />
      </div>
      <div className="mt-1.5 text-[11.5px]">
        {atLimit ? (
          <span className="font-medium text-danger">Limit reached — upgrade to add more.</span>
        ) : near ? (
          <span className="font-medium text-warning">Approaching your limit.</span>
        ) : unlimited ? (
          <span className="text-ink3">Unlimited {unit}s on this plan.</span>
        ) : (
          <span className="text-ink3">
            {limit! - used} {unit}
            {limit! - used === 1 ? "" : "s"} remaining.
          </span>
        )}
      </div>
    </div>
  );
}

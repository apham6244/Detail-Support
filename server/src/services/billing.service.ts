import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { stripeClient } from "../config/stripe";
import { serviceClient } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

type PaidPlan = "pro" | "team";

/**
 * Stripe → our subscription_status enum ('trialing' | 'active' | 'past_due' |
 * 'canceled'). Anything that isn't clearly paid-up maps to a state that
 * effective_plan() already degrades to Free, so access follows the money
 * automatically — no cron, no separate revocation path.
 */
export function mapStatus(s: Stripe.Subscription.Status): string {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      // Unknown future status: fail CLOSED (no access) rather than assume paid.
      return "past_due";
  }
}

const unix = (n: number | null | undefined) =>
  typeof n === "number" ? new Date(n * 1000).toISOString() : null;

/** Stripe rejects a trial_end that isn't at least 48 hours out. */
const MIN_STRIPE_TRIAL_SECONDS = 48 * 60 * 60;

/**
 * How much of the shop's existing 14-day trial to hand to Stripe.
 *
 * Upgrading mid-trial shouldn't cost someone the days they were promised — the
 * Billing page literally says "Trial — N days left", so charging on the spot
 * would make the UI a liar. We pass the SAME trial_ends_at the signup trigger
 * set, so Stripe holds the card and takes the first payment the moment the
 * original trial would have ended. The 14-day grant itself is untouched.
 *
 * Under 48 hours we bill immediately instead: Stripe refuses shorter trials, so
 * the alternative is a failed checkout, and a sub-2-day trial is worth ~nothing
 * to the customer anyway.
 *
 * Exported for tests — this is the decision the whole change turns on.
 */
export function remainingTrialEnd(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  now: number = Date.now()
): number | null {
  if (status !== "trialing" || !trialEndsAt) return null;

  const endsAtMs = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(endsAtMs)) return null;

  const endsAt = Math.floor(endsAtMs / 1000);
  const nowSec = Math.floor(now / 1000);

  // Covers already-expired trials too: the difference goes negative.
  if (endsAt - nowSec <= MIN_STRIPE_TRIAL_SECONDS) return null;
  return endsAt;
}

/** Period fields moved onto subscription items in newer API versions. */
function periodOf(sub: Stripe.Subscription) {
  const anySub = sub as any;
  const item = sub.items?.data?.[0] as any;
  return {
    start: unix(anySub.current_period_start ?? item?.current_period_start),
    end: unix(anySub.current_period_end ?? item?.current_period_end),
  };
}

/** What the UI needs to decide between "Upgrade" and "Manage billing". */
export async function billingStatus(db: SupabaseClient) {
  const { data } = await db
    .from("plans")
    .select("plan, monthly_price, stripe_price_id, stripe_price_id_founding")
    .order("sort_order");

  const purchasable: Record<string, boolean> = {};
  for (const p of data ?? []) {
    const row = p as { plan: string; stripe_price_id: string | null };
    if (row.plan !== "free") purchasable[row.plan] = Boolean(row.stripe_price_id);
  }

  return {
    configured: env.billingLive,
    testMode: env.billingTestMode,
    purchasable,
  };
}

function requireStripe(): Stripe {
  const stripe = stripeClient();
  if (!stripe) {
    throw new ApiError(503, "Billing isn't configured on this server yet.");
  }
  return stripe;
}

/** Only the owner touches money. */
function requireOwner(role: string | undefined) {
  if (role !== "owner") {
    throw new ApiError(403, "Only the workspace owner can manage billing.");
  }
}

/**
 * POST /api/billing/checkout — start a Stripe Checkout session.
 *
 * Reads everything through the caller's RLS-scoped client, so a caller can only
 * ever start checkout for a shop they belong to. Nothing about the plan or the
 * price comes from the request body beyond the plan NAME — the Price ID is
 * looked up server-side, so a client cannot ask to be charged $0 for Team.
 */
export async function createCheckoutSession(
  db: SupabaseClient,
  orgId: string,
  role: string | undefined,
  plan: PaidPlan
) {
  requireOwner(role);
  const stripe = requireStripe();

  const { data: planRow } = await db
    .from("plans")
    .select("plan, name, seat_limit, stripe_price_id, stripe_price_id_founding")
    .eq("plan", plan)
    .maybeSingle();
  if (!planRow) throw new ApiError(400, "Unknown plan.");

  const { data: sub } = await db
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, founding_member, plan, status, trial_ends_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!sub) throw new ApiError(404, "No subscription record for this workspace.");

  const row = planRow as {
    name: string;
    seat_limit: number;
    stripe_price_id: string | null;
    stripe_price_id_founding: string | null;
  };
  const s = sub as {
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    founding_member: boolean;
    status: string | null;
    trial_ends_at: string | null;
  };

  // Founding members keep the rate they were promised. If no founding price is
  // configured we deliberately do NOT silently bill them list price — that
  // would quietly break the locked-in-pricing promise the signup made.
  const priceId = s.founding_member
    ? row.stripe_price_id_founding ?? row.stripe_price_id
    : row.stripe_price_id;

  if (!priceId) {
    throw new ApiError(
      409,
      `The ${row.name} plan isn't connected to Stripe yet. Add its Price ID to the plans table.`
    );
  }

  // Downgrades that would strand teammates over the seat limit: refuse up
  // front. The DB only enforces seats when a member is ADDED, so letting this
  // through leaves the shop permanently over-limit with no way to notice.
  if (row.seat_limit != null) {
    const { count } = await db
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active");
    if ((count ?? 0) > row.seat_limit) {
      throw new ApiError(
        409,
        `${row.name} includes ${row.seat_limit} seat${row.seat_limit === 1 ? "" : "s"}, but this workspace has ${count} active members. Remove teammates before switching.`
      );
    }
  }

  // If they already have a live subscription, changing plans belongs in the
  // portal — a second Checkout would create a SECOND subscription and bill
  // them twice for the same shop.
  if (s.stripe_subscription_id) {
    throw new ApiError(
      409,
      "This workspace already has an active subscription. Use Manage billing to change plans."
    );
  }

  // Carry the rest of their existing trial over to Stripe (null = bill now).
  const trialEnd = remainingTrialEnd(s.status, s.trial_ends_at);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    // Reuse the customer if we know it, so their cards/history stay in one
    // place. When we don't, send nothing: in `subscription` mode Stripe always
    // creates the Customer itself, and `customer_creation` is a `payment`-mode
    // only param — passing it here is rejected outright. The webhook picks the
    // new customer id up from the subscription.
    ...(s.stripe_customer_id ? { customer: s.stripe_customer_id } : {}),
    client_reference_id: orgId,
    subscription_data: {
      // org_id on the SUBSCRIPTION is what the webhook trusts later — session
      // metadata isn't copied onto the subscription automatically.
      metadata: { org_id: orgId, plan },
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
    metadata: { org_id: orgId, plan },
    allow_promotion_codes: true,
    success_url: `${env.APP_URL}/billing?checkout=success`,
    cancel_url: `${env.APP_URL}/billing?checkout=cancelled`,
  });

  if (!session.url) throw new ApiError(502, "Stripe did not return a checkout URL.");
  return { url: session.url, sessionId: session.id };
}

/** POST /api/billing/portal — Stripe's hosted billing portal. */
export async function createPortalSession(
  db: SupabaseClient,
  orgId: string,
  role: string | undefined
) {
  requireOwner(role);
  const stripe = requireStripe();

  const { data: sub } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle();

  const customerId = (sub as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) {
    throw new ApiError(409, "This workspace doesn't have a billing account yet.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.APP_URL}/billing`,
  });
  return { url: session.url };
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Resolve which shop a Stripe subscription belongs to.
 * Prefers metadata written at checkout; falls back to the stored customer id.
 */
async function resolveOrg(svc: SupabaseClient, sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.org_id;
  if (fromMeta) return fromMeta;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;

  const { data } = await svc
    .from("subscriptions")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data as { org_id: string } | null)?.org_id ?? null;
}

/** Map the Price actually being billed back onto our plan names. */
async function resolvePlan(svc: SupabaseClient, sub: Stripe.Subscription): Promise<string | null> {
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (!priceId) return null;

  const { data } = await svc
    .from("plans")
    .select("plan")
    .or(`stripe_price_id.eq.${priceId},stripe_price_id_founding.eq.${priceId}`)
    .maybeSingle();
  return (data as { plan: string } | null)?.plan ?? null;
}

async function applySubscription(svc: SupabaseClient, sub: Stripe.Subscription) {
  const orgId = await resolveOrg(svc, sub);
  if (!orgId) {
    // Loud, not silent: a paid subscription we can't attribute is money taken
    // for nothing, and it must be findable in the logs.
    console.error(`⚠️  Stripe subscription ${sub.id} has no resolvable org_id — NOT applied.`);
    return { applied: false, reason: "unresolved_org" };
  }

  const plan = await resolvePlan(svc, sub);
  if (!plan) {
    console.error(
      `⚠️  Stripe subscription ${sub.id} bills a Price we don't recognise — NOT applied. ` +
        `Add its Price ID to public.plans.`
    );
    return { applied: false, reason: "unknown_price" };
  }

  const period = periodOf(sub);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  const { error } = await svc.rpc("apply_stripe_subscription", {
    p_org: orgId,
    p_plan: plan,
    p_status: mapStatus(sub.status),
    p_customer_id: customerId,
    p_subscription_id: sub.id,
    p_period_start: period.start,
    p_period_end: period.end,
    p_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    p_trial_ends_at: unix(sub.trial_end),
  });
  if (error) throw new Error(`apply_stripe_subscription failed: ${error.message}`);

  return { applied: true, orgId, plan, status: mapStatus(sub.status) };
}

/**
 * Verify + handle a Stripe webhook.
 *
 * Two things make this safe to retry, which Stripe WILL do:
 *   • Signature verification against the raw body — an unsigned POST to this
 *     endpoint can't move anyone onto a paid plan.
 *   • The stripe_events ledger claims each event id exactly once.
 *
 * We always re-fetch the subscription from Stripe rather than trusting the
 * event payload, so out-of-order delivery can't roll state backwards: whatever
 * we write is Stripe's current truth at the moment we process it.
 */
export async function handleStripeEvent(rawBody: Buffer, signature: string | undefined) {
  const stripe = requireStripe();
  if (!env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, "Webhook secret not configured.");
  if (!signature) throw new ApiError(400, "Missing Stripe-Signature header.");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    throw new ApiError(400, `Signature verification failed: ${(err as Error).message}`);
  }

  const svc = serviceClient();
  if (!svc) {
    // 500 (not 200) so Stripe retries once the key is configured, instead of
    // dropping the event forever.
    console.error("⚠️  Stripe webhook received but SUPABASE_SERVICE_ROLE_KEY is not set.");
    throw new ApiError(500, "Billing sync unavailable: service role key not configured.");
  }

  // Claim the event. A duplicate delivery loses the race and exits here.
  const { error: claimErr } = await svc
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, event_created: unix(event.created) });
  if (claimErr) {
    if (claimErr.code === "23505") return { received: true, duplicate: true, type: event.type };
    throw new Error(`Could not record Stripe event: ${claimErr.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subId) return { received: true, type: event.type, note: "no subscription on session" };
        const sub = await stripe.subscriptions.retrieve(subId);
        return { received: true, type: event.type, ...(await applySubscription(svc, sub)) };
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const incoming = event.data.object as Stripe.Subscription;
        // Deleted subscriptions can't be re-fetched meaningfully; for the rest
        // we take Stripe's current truth.
        const sub =
          event.type === "customer.subscription.deleted"
            ? incoming
            : await stripe.subscriptions.retrieve(incoming.id);
        return { received: true, type: event.type, ...(await applySubscription(svc, sub)) };
      }

      default:
        return { received: true, type: event.type, ignored: true };
    }
  } catch (err) {
    // Release the claim so Stripe's retry can have another go — otherwise a
    // transient failure would be permanently swallowed by the ledger.
    await svc.from("stripe_events").delete().eq("id", event.id);
    throw err;
  }
}

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Checkout logic tests: trial carry-over, founding-member price selection, and
 * the guards. Stripe is stubbed, so these assert the exact parameters we WOULD
 * send — which is the part that decides what a customer gets charged and when.
 */

const created = vi.fn(async (params: any) => ({ id: "cs_test_1", url: "https://checkout.stripe.test/c/1" }));

vi.mock("../config/stripe", () => ({
  stripeClient: () => ({ checkout: { sessions: { create: created } } }),
}));

const { createCheckoutSession, remainingTrialEnd, mapStatus } = await import("./billing.service");

const HOUR = 3600 * 1000;
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

type Sub = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  founding_member?: boolean;
  status?: string | null;
  trial_ends_at?: string | null;
};

/** Minimal chainable stand-in for the RLS-scoped Supabase client. */
function fakeDb(opts: { plan?: any; sub?: Sub | null; members?: number }) {
  const plan = opts.plan ?? {
    plan: "pro",
    name: "Pro",
    seat_limit: 1,
    stripe_price_id: "price_pro_list",
    stripe_price_id_founding: "price_pro_founding",
  };
  const sub =
    opts.sub === null
      ? null
      : {
          stripe_customer_id: null,
          stripe_subscription_id: null,
          founding_member: false,
          status: "active",
          trial_ends_at: null,
          ...opts.sub,
        };
  const members = opts.members ?? 1;

  return {
    from(table: string) {
      if (table === "plans") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: plan }) }) }) };
      }
      if (table === "subscriptions") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: sub }) }) }) };
      }
      if (table === "memberships") {
        return { select: () => ({ eq: () => ({ eq: async () => ({ count: members }) }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as any;
}

const ORG = "11111111-1111-1111-1111-111111111111";
const lastParams = () => created.mock.calls.at(-1)![0] as any;

beforeEach(() => created.mockClear());

// ---------------------------------------------------------------------------

describe("remainingTrialEnd — the 48-hour decision, in isolation", () => {
  const future = (h: number) => iso(h * HOUR);

  it("carries the trial over when more than 48h remain", () => {
    const t = future(13 * 24);
    expect(remainingTrialEnd("trialing", t)).toBe(Math.floor(new Date(t).getTime() / 1000));
  });

  it("bills immediately at exactly 48h (boundary is 'more than')", () => {
    expect(remainingTrialEnd("trialing", future(48))).toBeNull();
  });

  it("carries over just past the boundary (48h + 1min)", () => {
    expect(remainingTrialEnd("trialing", iso(48 * HOUR + 60_000))).not.toBeNull();
  });

  it("bills immediately with 24h left", () => {
    expect(remainingTrialEnd("trialing", future(24))).toBeNull();
  });

  it("bills immediately when the trial already expired", () => {
    expect(remainingTrialEnd("trialing", iso(-5 * 24 * HOUR))).toBeNull();
  });

  it("ignores the trial date when the shop isn't trialing", () => {
    expect(remainingTrialEnd("active", future(13 * 24))).toBeNull();
    expect(remainingTrialEnd("past_due", future(13 * 24))).toBeNull();
    expect(remainingTrialEnd("canceled", future(13 * 24))).toBeNull();
  });

  it("handles missing / malformed dates without throwing", () => {
    expect(remainingTrialEnd("trialing", null)).toBeNull();
    expect(remainingTrialEnd("trialing", "not-a-date")).toBeNull();
    expect(remainingTrialEnd(null, null)).toBeNull();
  });
});

describe("checkout passes the remaining trial to Stripe", () => {
  it("13 days left → trial_end == the ORIGINAL trial_ends_at (14-day grant untouched)", async () => {
    const trialEndsAt = iso(13 * 24 * HOUR);
    const db = fakeDb({ sub: { status: "trialing", trial_ends_at: trialEndsAt } });

    await createCheckoutSession(db, ORG, "owner", "pro");

    expect(lastParams().subscription_data.trial_end).toBe(
      Math.floor(new Date(trialEndsAt).getTime() / 1000)
    );
  });

  it("36h left → NO trial_end, so Stripe charges immediately", async () => {
    const db = fakeDb({ sub: { status: "trialing", trial_ends_at: iso(36 * HOUR) } });
    await createCheckoutSession(db, ORG, "owner", "pro");
    expect(lastParams().subscription_data).not.toHaveProperty("trial_end");
  });

  it("not trialing → NO trial_end", async () => {
    const db = fakeDb({ sub: { status: "active", trial_ends_at: iso(13 * 24 * HOUR) } });
    await createCheckoutSession(db, ORG, "owner", "pro");
    expect(lastParams().subscription_data).not.toHaveProperty("trial_end");
  });

  it("always tags the subscription with org_id + plan so the webhook can attribute it", async () => {
    const db = fakeDb({ sub: { status: "trialing", trial_ends_at: iso(10 * 24 * HOUR) } });
    await createCheckoutSession(db, ORG, "owner", "pro");
    expect(lastParams().subscription_data.metadata).toEqual({ org_id: ORG, plan: "pro" });
  });
});

describe("founding-member pricing is unchanged by the trial work", () => {
  it("founding member checks out against the FOUNDING price", async () => {
    const db = fakeDb({ sub: { founding_member: true } });
    await createCheckoutSession(db, ORG, "owner", "pro");
    expect(lastParams().line_items[0].price).toBe("price_pro_founding");
  });

  it("non-founding member checks out against the LIST price", async () => {
    const db = fakeDb({ sub: { founding_member: false } });
    await createCheckoutSession(db, ORG, "owner", "pro");
    expect(lastParams().line_items[0].price).toBe("price_pro_list");
  });

  it("founding member falls back to list price when no founding price is configured", async () => {
    const db = fakeDb({
      plan: {
        plan: "pro",
        name: "Pro",
        seat_limit: 1,
        stripe_price_id: "price_pro_list",
        stripe_price_id_founding: null,
      },
      sub: { founding_member: true },
    });
    await createCheckoutSession(db, ORG, "owner", "pro");
    expect(lastParams().line_items[0].price).toBe("price_pro_list");
  });

  it("founding member on a trial gets BOTH the founding price and the carried trial", async () => {
    const trialEndsAt = iso(13 * 24 * HOUR);
    const db = fakeDb({ sub: { founding_member: true, status: "trialing", trial_ends_at: trialEndsAt } });
    await createCheckoutSession(db, ORG, "owner", "pro");

    expect(lastParams().line_items[0].price).toBe("price_pro_founding");
    expect(lastParams().subscription_data.trial_end).toBe(
      Math.floor(new Date(trialEndsAt).getTime() / 1000)
    );
  });
});

describe("guards still hold", () => {
  it("a non-owner cannot start checkout", async () => {
    const db = fakeDb({});
    await expect(createCheckoutSession(db, ORG, "admin", "pro")).rejects.toThrow(/owner/i);
    expect(created).not.toHaveBeenCalled();
  });

  it("refuses a plan with no Price ID rather than charging the wrong thing", async () => {
    const db = fakeDb({
      plan: { plan: "team", name: "Team", seat_limit: 10, stripe_price_id: null, stripe_price_id_founding: null },
    });
    await expect(createCheckoutSession(db, ORG, "owner", "team")).rejects.toThrow(/isn't connected to Stripe/i);
    expect(created).not.toHaveBeenCalled();
  });

  it("refuses a downgrade that would strand teammates over the seat limit", async () => {
    const db = fakeDb({ members: 2 }); // Pro = 1 seat
    await expect(createCheckoutSession(db, ORG, "owner", "pro")).rejects.toThrow(/Remove teammates/i);
    expect(created).not.toHaveBeenCalled();
  });

  it("refuses a SECOND checkout when a subscription already exists (no double billing)", async () => {
    const db = fakeDb({ sub: { stripe_subscription_id: "sub_live_1" } });
    await expect(createCheckoutSession(db, ORG, "owner", "pro")).rejects.toThrow(/Manage billing/i);
    expect(created).not.toHaveBeenCalled();
  });

  it("reuses an existing Stripe customer instead of creating a duplicate", async () => {
    const db = fakeDb({ sub: { stripe_customer_id: "cus_existing" } });
    await createCheckoutSession(db, ORG, "owner", "pro");
    expect(lastParams().customer).toBe("cus_existing");
  });

  it("sends NO customer field when we don't know the customer yet", async () => {
    const db = fakeDb({ sub: { stripe_customer_id: null } });
    await createCheckoutSession(db, ORG, "owner", "pro");
    expect(lastParams()).not.toHaveProperty("customer");
  });

  // Regression: Stripe rejects `customer_creation` outside `payment` mode with
  // "`customer_creation` can only be used in `payment` mode." We are always in
  // `subscription` mode, so it must never appear — a stubbed Stripe happily
  // accepted it, and only the live API caught it.
  it("NEVER sends customer_creation (subscription mode rejects it)", async () => {
    for (const customer of [null, "cus_existing"]) {
      created.mockClear();
      await createCheckoutSession(fakeDb({ sub: { stripe_customer_id: customer } }), ORG, "owner", "pro");
      expect(lastParams()).not.toHaveProperty("customer_creation");
      expect(lastParams().mode).toBe("subscription");
    }
  });
});

describe("mapStatus — Stripe lifecycle onto our enum", () => {
  it("maps the paid-up states", () => {
    expect(mapStatus("active")).toBe("active");
    expect(mapStatus("trialing")).toBe("trialing");
  });

  it("maps every failure state to something effective_plan() degrades to Free", () => {
    expect(mapStatus("past_due")).toBe("past_due");
    expect(mapStatus("unpaid")).toBe("past_due");
    expect(mapStatus("incomplete")).toBe("past_due");
  });

  it("maps the terminal states to canceled", () => {
    expect(mapStatus("canceled")).toBe("canceled");
    expect(mapStatus("incomplete_expired")).toBe("canceled");
    expect(mapStatus("paused")).toBe("canceled");
  });

  it("fails CLOSED on an unknown future Stripe status", () => {
    expect(mapStatus("some_new_status" as any)).toBe("past_due");
  });
});

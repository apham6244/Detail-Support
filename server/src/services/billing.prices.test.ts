import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Pins the four plan → Stripe Price mappings end to end through
 * createCheckoutSession, using the real IDs from server/db/set_stripe_prices.sql.
 *
 * These values mirror the DATABASE catalog (Stripe test mode). The database is
 * the source of truth — this fixture exists so a wrong mapping fails here
 * rather than on a customer's card. If the Price IDs are ever rotated (e.g.
 * moving to live mode), update set_stripe_prices.sql and this fixture together.
 */
const PRICES = {
  pro: { list: "price_1Tu4LtRq531xK5mmGb7F3ubj", founding: "price_1Tu4PERq531xK5mmHb45uHUZ" },
  team: { list: "price_1Tu4N8Rq531xK5mmgUiVsrUc", founding: "price_1Tu4PdRq531xK5mm42UI4aMi" },
} as const;

const created = vi.fn(async () => ({ id: "cs_1", url: "https://checkout.stripe.test/c/1" }));
vi.mock("../config/stripe", () => ({
  stripeClient: () => ({ checkout: { sessions: { create: created } } }),
}));

const { createCheckoutSession } = await import("./billing.service");

const CATALOG = {
  pro: {
    plan: "pro",
    name: "Pro",
    seat_limit: 1,
    stripe_price_id: PRICES.pro.list,
    stripe_price_id_founding: PRICES.pro.founding,
  },
  team: {
    plan: "team",
    name: "Team",
    seat_limit: 10,
    stripe_price_id: PRICES.team.list,
    stripe_price_id_founding: PRICES.team.founding,
  },
};

function dbFor(plan: "pro" | "team", founding: boolean) {
  const row = CATALOG[plan];
  const sub = {
    stripe_customer_id: null,
    stripe_subscription_id: null,
    founding_member: founding,
    status: "active",
    trial_ends_at: null,
  };
  return {
    from(table: string) {
      if (table === "plans") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) };
      if (table === "subscriptions") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: sub }) }) }) };
      if (table === "memberships") return { select: () => ({ eq: () => ({ eq: async () => ({ count: 1 }) }) }) };
      throw new Error(`unexpected table: ${table}`);
    },
  } as any;
}

const ORG = "11111111-1111-1111-1111-111111111111";
const priceSentToStripe = () => (created.mock.calls.at(-1)![0] as any).line_items[0].price;

beforeEach(() => created.mockClear());

describe("the four Price IDs reach Stripe correctly", () => {
  const cases: Array<[string, "pro" | "team", boolean, string]> = [
    ["1. Pro checkout → Pro price", "pro", false, PRICES.pro.list],
    ["2. Pro FOUNDING checkout → Pro Founding price", "pro", true, PRICES.pro.founding],
    ["3. Team checkout → Team price", "team", false, PRICES.team.list],
    ["4. Team FOUNDING checkout → Team Founding price", "team", true, PRICES.team.founding],
  ];

  for (const [label, plan, founding, expected] of cases) {
    it(label, async () => {
      await createCheckoutSession(dbFor(plan, founding), ORG, "owner", plan);
      expect(priceSentToStripe()).toBe(expected);
    });
  }

  it("never crosses the streams: no combination sends another tier's price", async () => {
    const seen = new Set<string>();
    for (const [, plan, founding] of cases) {
      created.mockClear();
      await createCheckoutSession(dbFor(plan, founding), ORG, "owner", plan);
      seen.add(priceSentToStripe());
    }
    // Four distinct prices for four distinct combinations — no accidental reuse.
    expect(seen.size).toBe(4);
  });

  it("all four IDs are distinct in the fixture (guards against a copy/paste slip)", () => {
    const all = [PRICES.pro.list, PRICES.pro.founding, PRICES.team.list, PRICES.team.founding];
    expect(new Set(all).size).toBe(4);
  });
});

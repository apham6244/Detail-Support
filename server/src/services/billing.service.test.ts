import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

/**
 * Billing tests that need no Stripe account.
 *
 * The webhook's signature check is pure HMAC — no network — so the property
 * that actually matters here IS testable offline: an unsigned or wrongly-signed
 * POST must never move anyone onto a paid plan. That is the one thing standing
 * between "authentication by signature" and "anyone with the URL gets Team".
 *
 * Env is set before importing the app because config/env.ts validates at import.
 */
const WEBHOOK_SECRET = "whsec_test_secret_for_signature_verification_only";

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_key_no_network_calls_made";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  // Force the no-service-key state so this file tests the fail-closed path
  // deterministically. Empty string (not delete): dotenv fills in vars that are
  // absent from process.env but leaves existing ones alone, so deleting would
  // just let the developer's real .env leak back in — which is exactly what
  // happened once a real SUPABASE_SERVICE_ROLE_KEY was added and this file
  // started failing. Tests must not depend on what's in someone's .env.
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
});

async function makeApp() {
  const { createApp } = await import("../app");
  return createApp();
}

/** Build a genuinely valid Stripe-Signature header for a payload. */
async function signed(payload: string) {
  const Stripe = (await import("stripe")).default;
  return Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
}

const eventBody = (type: string) =>
  JSON.stringify({
    id: `evt_test_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "sub_test_123", object: "subscription" } },
  });

describe("Stripe webhook — signature is the authentication", () => {
  it("rejects a POST with NO signature header", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .send(eventBody("customer.subscription.updated"));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing Stripe-Signature/i);
  });

  it("rejects a forged signature", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
      .send(eventBody("customer.subscription.updated"));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Signature verification failed/i);
  });

  it("rejects a signature that is valid for DIFFERENT content (tamper check)", async () => {
    const app = await makeApp();
    const original = eventBody("invoice.created");
    const sig = await signed(original);

    // Same signature, body swapped for one that would grant Team.
    const tampered = original.replace("invoice.created", "customer.subscription.updated");

    const res = await request(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", sig)
      .send(tampered);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Signature verification failed/i);
  });

  it("accepts a correctly signed event (proves the test secret really verifies)", async () => {
    const app = await makeApp();
    const body = eventBody("invoice.created"); // a type we ignore — no Stripe API call
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", await signed(body))
      .send(body);

    // Signature passed, so we get PAST the gate. With no service-role key the
    // handler then fails closed with 500 so Stripe retries rather than the
    // event being silently dropped.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/service role key not configured/i);
  });

  it("does not require a JWT (Stripe has no session)", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/billing/webhook").send({});
    // 400 (bad signature), NOT 401 — proving requireAuth isn't in front of it.
    expect(res.status).toBe(400);
  });
});

describe("Billing routes — authentication and authorisation", () => {
  it("checkout without a token returns 401", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/billing/checkout").send({ plan: "team" });
    expect(res.status).toBe(401);
  });

  it("portal without a token returns 401", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/billing/portal").send({});
    expect(res.status).toBe(401);
  });

  it("status without a token returns 401", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/billing/status");
    expect(res.status).toBe(401);
  });

  it("rejects an unknown plan before any Stripe work happens", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/billing/checkout")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ plan: "enterprise" });
    // 400 from validation or 401 from auth — either way, never a checkout.
    expect([400, 401]).toContain(res.status);
  });
});

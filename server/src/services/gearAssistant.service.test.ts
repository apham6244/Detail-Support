import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

/**
 * Gear Assistant tests that need no Anthropic account.
 *
 * The live Claude round-trip can't be exercised without a key, but the two
 * things that must hold regardless CAN be tested offline: the route is
 * auth-gated, and with no key the service fails closed with a clean 503 instead
 * of throwing — never silently attempting a call it can't make.
 *
 * Env is forced BEFORE importing anything that reads it (env.ts validates at
 * import). Empty string, not delete: dotenv only fills vars absent from
 * process.env, so `""` keeps a developer's real key from leaking in.
 */
beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = "";
});

async function makeApp() {
  const { createApp } = await import("../app");
  return createApp();
}

describe("Gear Assistant — auth gating", () => {
  it("status without a token returns 401", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/gear/status");
    expect(res.status).toBe(401);
  });

  it("assistant without a token returns 401 (never reaches Claude)", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/gear/assistant").send({ question: "What should I buy with $500?" });
    expect(res.status).toBe(401);
  });
});

describe("Gear Assistant — fails closed with no API key", () => {
  it("assistantStatus() reports not configured", async () => {
    const { assistantStatus } = await import("./gearAssistant.service");
    expect(assistantStatus()).toEqual({ configured: false });
  });

  it("askGearAssistant() throws a clean 503 instead of calling Claude", async () => {
    const { askGearAssistant } = await import("./gearAssistant.service");
    // No key → it must bail before ever touching the db or the network.
    const db = {
      from() {
        throw new Error("db should not be touched when AI is unconfigured");
      },
    } as any;

    await expect(
      askGearAssistant(db, "org-1", "extractor or steamer first?", {})
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});

import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import {
  billingStatus,
  createCheckoutSession,
  createPortalSession,
  handleStripeEvent,
} from "../services/billing.service";

function db(req: Request) {
  if (!req.supabase) throw ApiError.unauthorized();
  return req.supabase;
}

function orgOf(req: Request) {
  if (!req.orgId) throw ApiError.forbidden("No active organization for this user");
  return req.orgId;
}

export const billingController = {
  /** GET /api/billing/status — is billing configured, and which plans can be bought. */
  status: asyncHandler(async (req: Request, res: Response) => {
    res.json(await billingStatus(db(req)));
  }),

  /** POST /api/billing/checkout { plan } */
  checkout: asyncHandler(async (req: Request, res: Response) => {
    const result = await createCheckoutSession(db(req), orgOf(req), req.role, req.body.plan);
    res.json(result);
  }),

  /** POST /api/billing/portal */
  portal: asyncHandler(async (req: Request, res: Response) => {
    res.json(await createPortalSession(db(req), orgOf(req), req.role));
  }),

  /**
   * POST /api/billing/webhook — called by Stripe, not by a browser.
   *
   * No JWT: the signature over the raw body IS the authentication. Never add
   * requireAuth here, and never trust anything in the body that hasn't been
   * through constructEvent().
   */
  webhook: asyncHandler(async (req: Request, res: Response) => {
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!raw) throw new ApiError(400, "Raw body unavailable for signature check.");
    const result = await handleStripeEvent(raw, req.header("stripe-signature"));
    res.json(result);
  }),
};

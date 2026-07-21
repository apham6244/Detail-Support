import { Router } from "express";
import { z } from "zod";
import { billingController } from "../controllers/billing.controller";
import { requireAuth, requireOrg } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

/**
 * Stripe's webhook. Mounted BEFORE requireAuth on purpose: Stripe is not a
 * signed-in user and carries no JWT. Its authentication is the signature over
 * the raw body, verified in the service. Everything below this line requires a
 * session; this line must not.
 */
router.post("/webhook", billingController.webhook);

// ── Everything past here is a signed-in shop owner ──────────────────────────
router.use(requireAuth, requireOrg);

router.get("/status", billingController.status);

// Only the plan NAME is accepted. The Price ID — the thing that decides what
// the card is charged — is resolved server-side from the plans table, so a
// crafted body can't pick its own price.
router.post(
  "/checkout",
  validate({ body: z.object({ plan: z.enum(["pro", "team"]) }) }),
  billingController.checkout
);

router.post("/portal", billingController.portal);

export default router;

import { Router } from "express";
import { z } from "zod";
import { gearController } from "../controllers/gear.controller";
import { requireAuth, requireOrg } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { aiLimiter } from "../middleware/rateLimiter";

const router = Router();

// Status is safe for any signed-in user — reveals only whether AI is configured.
router.get("/status", requireAuth, gearController.status);

// The assistant is org-scoped (it reads the shop's services for personalization)
// and rate-limited because each call spends real tokens.
router.post(
  "/assistant",
  requireAuth,
  requireOrg,
  aiLimiter,
  validate({
    body: z.object({
      question: z.string().trim().min(3, "Ask a question first.").max(1000),
      experience: z.string().max(60).optional(),
      budget: z.string().max(60).optional(),
      goal: z.string().max(120).optional(),
      currentEquipment: z.string().max(1000).optional(),
    }),
  }),
  gearController.ask
);

export default router;

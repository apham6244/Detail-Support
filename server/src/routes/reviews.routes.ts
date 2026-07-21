import { Router } from "express";
import { z } from "zod";
import { reviewsController } from "../controllers/reviews.controller";
import { requireAuth, requireOrg } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// Status reveals only whether Google is configured + what this org connected.
router.get("/status", requireAuth, reviewsController.status);

// Everything else is org-scoped. Connect/disconnect additionally hit the
// org_write RLS policy, so only owner/manager can actually change the link.
router.get("/search", requireAuth, requireOrg, reviewsController.search);
router.get("/", requireAuth, requireOrg, reviewsController.list);

router.post(
  "/connect",
  requireAuth,
  requireOrg,
  validate({ body: z.object({ placeId: z.string().trim().min(1, "placeId is required").max(300) }) }),
  reviewsController.connect
);

router.post("/disconnect", requireAuth, requireOrg, reviewsController.disconnect);

export default router;

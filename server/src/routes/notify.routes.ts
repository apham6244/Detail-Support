import { Router } from "express";
import { z } from "zod";
import { notifyController } from "../controllers/notify.controller";
import { requireAuth, requireOrg } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// Status is safe to expose to any signed-in user (it reveals no secrets).
router.get("/status", requireAuth, notifyController.status);

// Sends are org-scoped. Authorisation is the database's job: the service
// resolves each record through the caller's RLS-scoped client.
router.use(requireAuth, requireOrg);

router.post(
  "/invitation",
  validate({ body: z.object({ invitationId: z.string().uuid() }) }),
  notifyController.invitation
);

router.post(
  "/reminder",
  validate({ body: z.object({ reminderId: z.string().uuid() }) }),
  notifyController.reminder
);

// Bulk send. The body carries only the campaign id — the recipient list is
// recomputed server-side from live data, never accepted from the client.
router.post(
  "/campaign",
  validate({ body: z.object({ campaignId: z.string().uuid() }) }),
  notifyController.campaign
);

export default router;

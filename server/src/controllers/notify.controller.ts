import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { deliveryStatus, sendCampaign, sendInvitation, sendReminder } from "../services/notify.service";

function db(req: Request) {
  if (!req.supabase) throw ApiError.unauthorized();
  return req.supabase;
}

export const notifyController = {
  /** GET /api/notify/status — which channels are actually live. */
  status: asyncHandler(async (_req: Request, res: Response) => {
    res.json(deliveryStatus());
  }),

  /** POST /api/notify/invitation { invitationId } */
  invitation: asyncHandler(async (req: Request, res: Response) => {
    const result = await sendInvitation(db(req), req.body.invitationId);
    res.json(result);
  }),

  /** POST /api/notify/reminder { reminderId } */
  reminder: asyncHandler(async (req: Request, res: Response) => {
    const result = await sendReminder(db(req), req.body.reminderId);
    res.json(result);
  }),

  /** POST /api/notify/campaign { campaignId } — bulk send to a live segment. */
  campaign: asyncHandler(async (req: Request, res: Response) => {
    const result = await sendCampaign(db(req), req.body.campaignId);
    res.json(result);
  }),
};

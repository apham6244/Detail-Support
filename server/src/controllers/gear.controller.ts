import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { askGearAssistant, assistantStatus } from "../services/gearAssistant.service";

function db(req: Request) {
  if (!req.supabase) throw ApiError.unauthorized();
  return req.supabase;
}

function orgOf(req: Request) {
  if (!req.orgId) throw ApiError.forbidden("No active organization for this user");
  return req.orgId;
}

export const gearController = {
  /** GET /api/gear/status — is the AI assistant configured. */
  status: asyncHandler(async (_req: Request, res: Response) => {
    res.json(assistantStatus());
  }),

  /** POST /api/gear/assistant { question, experience?, budget?, goal?, currentEquipment? } */
  ask: asyncHandler(async (req: Request, res: Response) => {
    const { question, experience, budget, goal, currentEquipment } = req.body;
    const answer = await askGearAssistant(db(req), orgOf(req), question, {
      experience,
      budget,
      goal,
      currentEquipment,
    });
    res.json(answer);
  }),
};

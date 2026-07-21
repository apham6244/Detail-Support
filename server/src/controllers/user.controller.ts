import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { userService } from "../services/user.service";

export const userController = {
  me: asyncHandler(async (req: Request, res: Response) => {
    const profile = await userService.getProfile(req.supabase!, req.user!.id);
    res.json({ user: req.user, profile });
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const profile = await userService.updateProfile(
      req.supabase!,
      req.user!.id,
      req.body
    );
    res.json({ profile });
  }),
};

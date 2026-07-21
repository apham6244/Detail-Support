import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateProfileSchema } from "../schemas/auth.schema";

const router = Router();

router.use(requireAuth);

router.get("/me", userController.me);
router.patch("/me", validate({ body: updateProfileSchema }), userController.updateMe);

export default router;

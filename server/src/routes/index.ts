import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import notifyRoutes from "./notify.routes";
import billingRoutes from "./billing.routes";
import gearRoutes from "./gear.routes";
import reviewsRoutes from "./reviews.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "detail-support-api", time: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/notify", notifyRoutes);
router.use("/billing", billingRoutes);
router.use("/gear", gearRoutes);
router.use("/reviews", reviewsRoutes);

export default router;

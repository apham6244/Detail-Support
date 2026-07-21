import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { apiLimiter } from "./middleware/rateLimiter";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { ApiError } from "./utils/ApiError";

export function createApp() {
  const app = express();

  // Behind a proxy (Render/Fly/Nginx) so rate-limit sees real client IPs.
  app.set("trust proxy", 1);

  // --- Security & platform middleware -------------------------------------
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin header) and the
        // explicit allow-list. Everything else is rejected.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(new ApiError(403, `Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(compression());
  // Capture the raw body so provider webhook signatures can be verified.
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  if (!env.isProd) app.use(morgan("dev"));

  // --- Routes --------------------------------------------------------------
  app.use("/api", apiLimiter, apiRoutes);

  // --- Fallbounds ----------------------------------------------------------
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

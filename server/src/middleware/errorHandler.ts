import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

/**
 * Central error handler — the only place that shapes an error response.
 * Normalizes ApiError, zod errors, and anything unexpected into:
 *   { error: string, details?: unknown }
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  // Known application errors
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  // Zod errors that slipped through (defensive)
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // Unknown / unexpected — log server-side, don't leak internals to client.
  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: "Internal server error",
    ...(env.isProd ? {} : { details: String(err) }),
  });
}

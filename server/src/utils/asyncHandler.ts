import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrap an async route handler so any rejected promise is forwarded to
 * Express's error middleware instead of crashing the process.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

import type { Request, Response, NextFunction } from "express";
import { z, type ZodTypeAny } from "zod";
import { ApiError } from "../utils/ApiError";

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * validate — parse and coerce request parts against zod schemas. On success
 * the parsed (typed, defaulted) values replace the originals. On failure a
 * 400 is thrown with a field-by-field breakdown.
 */
export const validate =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as any;
      if (schemas.params) req.params = schemas.params.parse(req.params) as any;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fields = err.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }));
        throw ApiError.badRequest("Validation failed", fields);
      }
      throw err;
    }
  };

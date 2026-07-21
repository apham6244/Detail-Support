import { z } from "zod";

/** :id route param must be a UUID. */
export const idParam = z.object({
  id: z.string().uuid("Invalid id"),
});

/** Shared list/pagination query. */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(["created_at", "updated_at", "name"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type Pagination = z.infer<typeof paginationQuery>;

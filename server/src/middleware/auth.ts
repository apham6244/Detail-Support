import type { Request, Response, NextFunction } from "express";
import { supabaseAnon, userClient } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * requireAuth — validates the Supabase access token on the Authorization
 * header. On success attaches:
 *   req.user     → { id, email, role }
 *   req.supabase → a Supabase client scoped to this token (RLS enforced)
 *   req.orgId    → the active org (tenant) for this request
 *   req.role     → the caller's role in that org
 *
 * Org resolution: uses the caller's active membership. An optional `X-Org-Id`
 * header selects a specific org when a user belongs to several; RLS still
 * enforces membership, so the header can't grant access to a non-member org.
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw ApiError.unauthorized("Missing or malformed Authorization header");
    }

    // Verify the JWT with Supabase's auth API. The anon key is enough for
    // this — no service_role key needs to exist on this server.
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data.user) {
      throw ApiError.unauthorized("Invalid or expired session");
    }

    const db = userClient(token);
    req.user = {
      id: data.user.id,
      email: data.user.email ?? null,
      role: (data.user.user_metadata?.role as string) ?? "owner",
    };
    req.supabase = db;

    // Resolve the active org + role from memberships (RLS-scoped read).
    const orgHeader = req.header("X-Org-Id");
    let q = db
      .from("memberships")
      .select("org_id, role")
      .eq("status", "active");
    if (orgHeader) q = q.eq("org_id", orgHeader);
    const { data: membership } = await q.limit(1).maybeSingle();
    if (membership) {
      req.orgId = (membership as { org_id: string }).org_id;
      req.role = (membership as { role: string }).role;
    }

    next();
  }
);

/** Require the request to be scoped to an org (a member of some shop). */
export const requireOrg = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.orgId) throw ApiError.forbidden("No active organization for this user");
  next();
};

/** Restrict a route to specific profile roles (e.g. owner-only settings). */
export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden("You do not have access to this resource");
    }
    next();
  };

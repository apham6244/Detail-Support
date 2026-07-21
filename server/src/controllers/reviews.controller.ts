import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import {
  reviewsStatus, searchBusinesses, getPlaceReviews,
  type ReviewProvider,
} from "../services/googleReviews.service";

/**
 * The connected business lives in `organizations.settings.google_business`
 * (jsonb, already on the table since migration 010) — no new table needed.
 * Reads are allowed for any member; writes hit the org_write RLS policy, so
 * only owner/manager can connect or disconnect.
 */
interface Connection {
  provider: ReviewProvider;
  placeId: string;
  name: string;
  address: string | null;
  connectedAt: string;
}

function db(req: Request) {
  if (!req.supabase) throw ApiError.unauthorized();
  return req.supabase;
}
function orgOf(req: Request) {
  if (!req.orgId) throw ApiError.forbidden("No active organization for this user");
  return req.orgId;
}

async function readSettings(req: Request): Promise<Record<string, unknown>> {
  const { data, error } = await db(req)
    .from("organizations")
    .select("settings")
    .eq("id", orgOf(req))
    .single();
  if (error) throw new ApiError(500, error.message);
  return ((data as { settings?: Record<string, unknown> })?.settings ?? {}) as Record<string, unknown>;
}

async function readConnection(req: Request): Promise<Connection | null> {
  const settings = await readSettings(req);
  return (settings.google_business as Connection | undefined) ?? null;
}

async function writeConnection(req: Request, value: Connection | null) {
  const settings = await readSettings(req);
  const next = { ...settings };
  if (value) next.google_business = value;
  else delete next.google_business;

  const { error } = await db(req)
    .from("organizations")
    .update({ settings: next })
    .eq("id", orgOf(req));
  if (error) {
    // RLS rejects non owner/manager updates — translate to a clear 403.
    throw ApiError.forbidden("Only an owner or manager can change the Google connection.");
  }
}

export const reviewsController = {
  /** GET /api/reviews/status — is Google configured, and what's connected. */
  status: asyncHandler(async (req: Request, res: Response) => {
    const base = reviewsStatus();
    const connected = req.orgId ? await readConnection(req) : null;
    res.json({ ...base, connected });
  }),

  /** GET /api/reviews/search?q= — find a business on Google by name. */
  search: asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) throw ApiError.badRequest("Type at least 2 characters to search.");
    res.json({ results: await searchBusinesses(q) });
  }),

  /** POST /api/reviews/connect { placeId } — link a business to this org. */
  connect: asyncHandler(async (req: Request, res: Response) => {
    const placeId = String(req.body?.placeId ?? "").trim();
    if (!placeId) throw ApiError.badRequest("placeId is required.");

    // Verify with Google before saving, so we never store a dead link.
    const payload = await getPlaceReviews(placeId);
    const connection: Connection = {
      provider: payload.provider,
      placeId: payload.business.placeId,
      name: payload.business.name,
      address: payload.business.address,
      connectedAt: new Date().toISOString(),
    };
    await writeConnection(req, connection);
    res.json({ connected: connection, ...payload });
  }),

  /** POST /api/reviews/disconnect */
  disconnect: asyncHandler(async (req: Request, res: Response) => {
    await writeConnection(req, null);
    res.json({ connected: null });
  }),

  /** GET /api/reviews — live rating + reviews for the connected business. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const connection = await readConnection(req);
    if (!connection) throw ApiError.badRequest("No Google Business Profile is connected yet.");
    const payload = await getPlaceReviews(connection.placeId);
    res.json({ connected: connection, ...payload });
  }),
};

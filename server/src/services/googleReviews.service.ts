import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

/**
 * Google reviews — provider layer.
 *
 * TODAY: Google **Places API (New)**. It supports searching for a business by
 * name (the connect flow) and returns the authoritative overall `rating` and
 * `userRatingCount`, plus up to **5** reviews. Places does NOT expose owner
 * responses and has no pagination — that is a hard API limit, not a bug.
 *
 * LATER: the **Business Profile API** gives the full review history, owner
 * responses, and the ability to reply — but it requires OAuth (the detailer
 * signs in with the Google account that manages the listing) and Google must
 * approve API access first. It also cannot search arbitrary businesses; you
 * list only the locations the authenticated user manages.
 *
 * Everything below is normalized into the provider-agnostic shapes at the top,
 * so adding a `businessProfile` provider means implementing the same two
 * functions and switching on the connection's `provider` field.
 */

export type ReviewProvider = "places" | "business_profile";

export interface BusinessMatch {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  totalReviews: number | null;
}

export interface GoogleReview {
  id: string;
  author: string;
  authorPhoto: string | null;
  rating: number;
  text: string | null;
  publishedAt: string | null;
  relativeTime: string | null;
  /** Owner reply — always null on Places; populated by Business Profile. */
  ownerResponse: { text: string; publishedAt: string | null } | null;
}

export interface ReviewsPayload {
  business: BusinessMatch;
  mapsUrl: string | null;
  rating: number | null;
  totalReviews: number | null;
  reviews: GoogleReview[];
  /** How many reviews this provider can return at most (Places = 5). */
  reviewLimit: number | null;
  provider: ReviewProvider;
  /** True when `reviews` is a capped sample rather than the full history. */
  sampled: boolean;
}

const PLACES_BASE = "https://places.googleapis.com/v1";
const PLACES_REVIEW_LIMIT = 5;

export function reviewsStatus() {
  return { configured: env.googleReviewsLive, provider: "places" as ReviewProvider };
}

function key(): string {
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw ApiError.badRequest(
      "Google reviews aren't configured on the server. Add GOOGLE_PLACES_API_KEY to enable them."
    );
  }
  return env.GOOGLE_PLACES_API_KEY;
}

async function placesFetch<T>(url: string, fieldMask: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key(),
        "X-Goog-FieldMask": fieldMask,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(502, "Couldn't reach Google. Try again in a moment.");
  }

  const body = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const msg = body?.error?.message ?? `Google returned ${res.status}`;
    // Surface quota/permission problems clearly — they're setup issues.
    throw new ApiError(res.status === 403 ? 403 : 502, `Google Places: ${msg}`);
  }
  return body as T;
}

/** Search Google for a business by name (the connect flow). */
export async function searchBusinesses(query: string): Promise<BusinessMatch[]> {
  const data = await placesFetch<{ places?: any[] }>(
    `${PLACES_BASE}/places:searchText`,
    "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
    { method: "POST", body: JSON.stringify({ textQuery: query, maxResultCount: 8 }) }
  );
  return (data.places ?? []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed business",
    address: p.formattedAddress ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    totalReviews: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
  }));
}

/** Fetch the live rating + reviews for a connected place. */
export async function getPlaceReviews(placeId: string): Promise<ReviewsPayload> {
  const p = await placesFetch<any>(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`,
    "id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews"
  );

  const reviews: GoogleReview[] = (p.reviews ?? []).map((r: any, i: number) => ({
    id: r.name ?? `${placeId}-${i}`,
    author: r.authorAttribution?.displayName ?? "Google user",
    authorPhoto: r.authorAttribution?.photoUri ?? null,
    rating: typeof r.rating === "number" ? r.rating : 0,
    text: r.text?.text ?? r.originalText?.text ?? null,
    publishedAt: r.publishTime ?? null,
    relativeTime: r.relativePublishTimeDescription ?? null,
    ownerResponse: null, // Places never returns owner replies.
  }));

  const totalReviews = typeof p.userRatingCount === "number" ? p.userRatingCount : null;

  return {
    business: {
      placeId: p.id ?? placeId,
      name: p.displayName?.text ?? "Your business",
      address: p.formattedAddress ?? null,
      rating: typeof p.rating === "number" ? p.rating : null,
      totalReviews,
    },
    mapsUrl: p.googleMapsUri ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    totalReviews,
    reviews,
    reviewLimit: PLACES_REVIEW_LIMIT,
    provider: "places",
    sampled: totalReviews != null && totalReviews > reviews.length,
  };
}

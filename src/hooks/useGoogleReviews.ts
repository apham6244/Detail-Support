import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Google reviews, read straight from the user's Google Business Profile via the
 * server (the API key never touches the browser). Nothing here is stored or
 * editable in Detail Support — the page is a read-only mirror of Google.
 */

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
  ownerResponse: { text: string; publishedAt: string | null } | null;
}

export interface Connection {
  provider: string;
  placeId: string;
  name: string;
  address: string | null;
  connectedAt: string;
}

export interface ReviewsPayload {
  connected: Connection;
  business: BusinessMatch;
  mapsUrl: string | null;
  rating: number | null;
  totalReviews: number | null;
  reviews: GoogleReview[];
  reviewLimit: number | null;
  provider: string;
  /** True when `reviews` is a capped sample of a larger total on Google. */
  sampled: boolean;
}

export function useGoogleReviews() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connected, setConnected] = useState<Connection | null>(null);
  const [data, setData] = useState<ReviewsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial status: is Google configured, and has this org connected a place?
  useEffect(() => {
    let alive = true;
    api<{ configured: boolean; connected: Connection | null }>("/reviews/status")
      .then((s) => {
        if (!alive) return;
        setConfigured(s.configured);
        setConnected(s.connected);
      })
      .catch(() => alive && setConfigured(false));
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<ReviewsPayload>("/reviews");
      setData(payload);
      setConnected(payload.connected);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Pull reviews once a business is connected.
  useEffect(() => {
    if (connected && !data) refresh();
  }, [connected, data, refresh]);

  const search = useCallback(async (q: string) => {
    const { results } = await api<{ results: BusinessMatch[] }>(`/reviews/search?q=${encodeURIComponent(q)}`);
    return results;
  }, []);

  const connect = useCallback(async (placeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<ReviewsPayload>("/reviews/connect", {
        method: "POST",
        body: JSON.stringify({ placeId }),
      });
      setData(payload);
      setConnected(payload.connected);
      return payload;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await api("/reviews/disconnect", { method: "POST" });
    setConnected(null);
    setData(null);
  }, []);

  return { configured, connected, data, loading, error, search, connect, disconnect, refresh };
}

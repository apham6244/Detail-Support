import Stripe from "stripe";
import { env } from "./env";

/**
 * Stripe client — lazy and optional, mirroring serviceClient() in supabase.ts.
 *
 * Without STRIPE_SECRET_KEY this returns null and every billing route reports
 * "not configured" rather than throwing. That keeps the app fully usable with
 * no Stripe account at all: the manual plan switcher from 024 stays live until
 * a real Price ID is attached, at which point the database itself takes over
 * enforcement.
 */
let _stripe: Stripe | null | undefined;

export function stripeClient(): Stripe | null {
  if (_stripe !== undefined) return _stripe;
  _stripe = env.STRIPE_SECRET_KEY
    ? new Stripe(env.STRIPE_SECRET_KEY, {
        // Pin the API version: Stripe ships breaking changes behind it, and an
        // unpinned client can start failing on a date we didn't choose.
        apiVersion: "2026-06-24.dahlia",
        typescript: true,
        appInfo: { name: "Detail Support", version: "1.0.0" },
      })
    : null;
  return _stripe;
}

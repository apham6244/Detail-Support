import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * anon client — used for unauthenticated auth flows (sign up, sign in).
 * Respects RLS.
 */
export const supabaseAnon: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * service_role client — the ONE deliberate exception to "RLS is the boundary".
 *
 * This file used to say there was no service_role client, because nothing here
 * needed to bypass RLS: every request carries a caller's JWT and reads through
 * userClient() below. The reminder scheduler broke that assumption — it runs on
 * a timer with no user session, so there is no JWT whose RLS could scope it. A
 * background worker needs a privileged credential; there is no way around it.
 *
 * The exception is kept as small as possible:
 *   • It is OPTIONAL. Without SUPABASE_SERVICE_ROLE_KEY this returns null and
 *     the scheduler simply doesn't start — every user-facing path still runs
 *     through userClient() and RLS.
 *   • It is used ONLY by the reminder queue (claim_due_reminders /
 *     requeue_stale_reminders and the row updates that follow a send). No
 *     request handler touches it, so a request can never ride it across tenants.
 *   • The claim/requeue functions are granted to service_role only, so the key
 *     is what gates the queue.
 */
let _service: SupabaseClient | null | undefined;
export function serviceClient(): SupabaseClient | null {
  if (_service !== undefined) return _service;
  _service = env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
  return _service;
}

/**
 * userClient — a Supabase client scoped to a caller's access token. Because
 * the JWT travels on every request, Row-Level Security in Postgres enforces
 * that queries only ever touch this user's own rows. All data services use
 * this, so the database is the security boundary, not just app code.
 */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

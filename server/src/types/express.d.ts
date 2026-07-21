import type { SupabaseClient } from "@supabase/supabase-js";

/** The authenticated caller, derived from a validated Supabase JWT. */
export interface AuthUser {
  id: string;
  email: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Present on routes behind `requireAuth`. */
      user?: AuthUser;
      /** Supabase client scoped to the caller's JWT (RLS enforced). */
      supabase?: SupabaseClient;
      /** The org (tenant) this request acts within. */
      orgId?: string;
      /** The caller's role in that org (owner/manager/technician). */
      role?: string;
    }
  }
}

export {};

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/**
 * Whether Supabase auth is usable. Empty vars or the leftover "placeholder"
 * value count as not configured — so the UI shows a clear setup notice instead
 * of attempting a request that would fail with a cryptic network error.
 */
export const supabaseConfigured =
  Boolean(url) && Boolean(anonKey) && !url.includes("placeholder");

/**
 * The Supabase client, or null when not configured. persistSession +
 * autoRefreshToken keep the user logged in across refreshes automatically.
 */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

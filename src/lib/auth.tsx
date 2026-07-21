import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import { setToken } from "./api";
import { isDemo, DEMO_ORG, DEMO_USER, DEMO_PROFILE, DEMO_ROLE } from "./demo";

interface AuthUser {
  id: string;
  email: string | null;
}

interface Profile {
  full_name: string | null;
  business_name: string | null;
}

interface Org {
  id: string;
  name: string;
  plan: string;
}

export interface SignupDetails {
  fullName: string;
  email: string;
  password: string;
  businessName: string;
  ownerName?: string;
  phone?: string;
  businessEmail?: string;
  location?: string;
  plan: "free" | "pro" | "team";
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  org: Org | null;
  role: string | null;
  isAuthenticated: boolean;
  configured: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (details: SignupDetails) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const NOT_CONFIGURED =
  "Authentication isn't configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the frontend .env, then restart.";

/** Turn raw Supabase/network errors into messages a person can act on. */
function friendlyError(err: unknown): Error {
  const raw = (err as { message?: string })?.message ?? String(err ?? "");
  const m = raw.toLowerCase();

  if (m.includes("fetch") || m.includes("network") || m.includes("load failed"))
    return new Error(
      "Connection error — couldn't reach the authentication server. Check your internet and that your Supabase URL is correct."
    );
  if (m.includes("invalid login credentials"))
    return new Error("Invalid email or password.");
  if (m.includes("email") && m.includes("invalid"))
    return new Error(
      "That email address was rejected. Use a real, deliverable email (test domains like example.com don't work)."
    );
  if (m.includes("already registered") || m.includes("already been registered"))
    return new Error("That email is already registered. Try signing in instead.");
  if (m.includes("email not confirmed"))
    return new Error("Please confirm your email first — check your inbox for the link.");
  if (m.includes("password") && (m.includes("least") || m.includes("short")))
    return new Error("Password is too short — use at least 8 characters.");
  if (m.includes("rate limit") || m.includes("too many"))
    return new Error("Too many attempts. Please wait a moment and try again.");
  return new Error(raw || "Something went wrong. Please try again.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Restore any persisted session on load (keeps the user logged in on refresh).
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
      setLoading(false);
    });

    // React to sign-in, sign-out, and silent token refreshes.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySession(session: Session | null) {
    if (session?.user) {
      setUser({ id: session.user.id, email: session.user.email ?? null });
      setToken(session.access_token); // backend data calls reuse this JWT
      void loadProfile(session.user.id);
      void loadOrg(session.user.id);
    } else {
      setUser(null);
      setProfile(null);
      setOrg(null);
      setRole(null);
      setToken(null);
    }
  }

  async function loadProfile(id: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, business_name")
      .eq("id", id)
      .maybeSingle();
    if (data) setProfile(data as Profile);
  }

  // Load the user's active org (shop) + their role in it — RLS returns only
  // memberships the caller belongs to.
  async function loadOrg(id: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from("memberships")
      .select("role, created_at, organization:organizations(id, name, plan)")
      .eq("user_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.organization) {
      setOrg(data.organization as unknown as Org);
      setRole((data as { role: string }).role);
    }
  }

  const login = async (email: string, password: string) => {
    if (!supabase) throw new Error(NOT_CONFIGURED);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw friendlyError(error);
    // Session is applied by onAuthStateChange.
  };

  const register = async (d: SignupDetails) => {
    if (!supabase) throw new Error(NOT_CONFIGURED);
    const businessName = d.businessName.trim() || `${d.fullName}'s Shop`;

    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        data: { full_name: d.fullName, business_name: businessName, role: "owner" },
      },
    });
    if (error) throw friendlyError(error);

    // With a session (email confirmation off), the Phase-0 trigger has already
    // created the workspace — persist the rest of the business setup + plan.
    if (data.session && data.user) {
      await supabase
        .from("organizations")
        .update({
          name: businessName,
          settings: {
            owner_name: d.ownerName || d.fullName,
            phone: d.phone ?? null,
            business_email: d.businessEmail ?? null,
            location: d.location ?? null,
            selected_plan: d.plan,
            founding_member: true,
          },
        })
        .eq("owner_user_id", data.user.id);
    }

    return { needsConfirmation: !data.session };
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setOrg(null);
    setRole(null);
    setToken(null);
  };

  // Demo overlay — a synthetic, read-only identity so a visitor can explore the
  // app without an account. It applies ONLY when there is no real session, so a
  // signed-in user can never be shadowed by it. Nothing below is persisted and
  // no token is set, so demo can't authenticate against Supabase or the API.
  const demo = isDemo() && !user;

  return (
    <AuthContext.Provider
      value={{
        user: demo ? DEMO_USER : user,
        profile: demo ? DEMO_PROFILE : profile,
        org: demo ? DEMO_ORG : org,
        role: demo ? DEMO_ROLE : role,
        isAuthenticated: demo ? true : Boolean(user),
        configured: supabaseConfigured,
        loading: demo ? false : loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

import { useState, type FormEvent } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { DSIcon } from "@/components/brand/Logo";
import { AuthShell, AuthField } from "@/components/auth/AuthShell";

export default function Login() {
  const { login, configured, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <Link to="/welcome" className="group mb-7 flex items-center gap-3">
        <div className="relative">
          <div className="absolute -inset-1.5 rounded-2xl bg-brand-500/30 blur-md transition group-hover:bg-brand-500/40" />
          <DSIcon size={46} className="relative" />
        </div>
        <div>
          <div className="font-display text-[19px] font-bold text-white">Detail Support</div>
          <div className="text-[13px] text-white/55">Run your detailing business smarter</div>
        </div>
      </Link>

      <div className="auth-card rounded-[22px] p-7 sm:p-8">
        <h1 className="font-display text-[23px] font-bold tracking-tight text-white">Welcome back</h1>
        <p className="mb-6 mt-1 text-[13.5px] text-white/55">Log in to your detailing workspace.</p>

        {!configured && (
          <div className="mb-5 rounded-xl bg-warning/15 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-100 ring-1 ring-inset ring-warning/25">
            Authentication isn't configured yet. Add <code className="text-amber-200">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> to <code className="text-amber-200">.env</code>, then restart.
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <AuthField label="Email" icon={<Mail />}>
            <input
              type="email" required className="auth-input has-icon"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email"
            />
          </AuthField>
          <AuthField label="Password" icon={<Lock />}>
            <input
              type="password" required className="auth-input has-icon"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password" autoComplete="current-password"
            />
          </AuthField>

          {error && (
            <div className="rounded-xl bg-danger/15 px-3.5 py-3 text-[12.5px] text-red-200 ring-1 ring-inset ring-danger/30">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy || !configured} className="auth-btn mt-1.5">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
            <span className="relative inline-flex items-center justify-center gap-2">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : <>Log in <ArrowRight className="h-4 w-4" /></>}
            </span>
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-center text-[13px] text-white/55">
          New to Detail Support?{" "}
          <Link to="/signup" className="font-semibold text-brand-300 transition hover:text-brand-200">
            Create an account
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

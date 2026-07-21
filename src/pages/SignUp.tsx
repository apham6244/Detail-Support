import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Check, ArrowLeft, ArrowRight, Loader2, User, Mail, Lock,
  Building2, Phone, AtSign, MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { DSIcon } from "@/components/brand/Logo";
import { AuthShell, AuthField } from "@/components/auth/AuthShell";
import { cn } from "@/lib/cn";

type Plan = "free" | "pro" | "team";

const PLANS: {
  id: Plan;
  name: string;
  price: string;
  cadence: string;
  features: string[];
  badge?: string;
}[] = [
  { id: "free", name: "Free", price: "$0", cadence: "forever", features: ["Basic features", "Up to 25 customers", "Appointments & invoices"] },
  { id: "pro", name: "Pro", price: "$5", cadence: "/month", features: ["Unlimited customers", "Booking & reminders", "Invoices & reports"], badge: "Most popular" },
  { id: "team", name: "Team", price: "$15", cadence: "/month", features: ["Everything in Pro", "Multiple employees", "Team roles & permissions"] },
];

export default function SignUp() {
  const { register, configured, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // step 2
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [location, setLocation] = useState("");
  // step 3
  const [plan, setPlan] = useState<Plan>("pro");

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  const next = () => {
    setError(null);
    if (step === 1) {
      if (!fullName.trim()) return setError("Enter your full name.");
      if (!email.trim()) return setError("Enter your email.");
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (password !== confirm) return setError("Passwords don't match.");
      setStep(2);
    } else if (step === 2) {
      if (!businessName.trim()) return setError("Enter your business name.");
      setOwnerName((o) => o || fullName);
      setStep(3);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { needsConfirmation } = await register({
        fullName, email, password, businessName,
        ownerName: ownerName || fullName, phone, businessEmail, location, plan,
      });
      if (needsConfirmation) {
        setInfo("Account created! Confirm your email, then log in to reach your workspace.");
      } else {
        navigate("/");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell wide>
      <Link to="/welcome" className="group mb-6 flex items-center gap-2.5">
        <div className="relative">
          <div className="absolute -inset-1.5 rounded-xl bg-brand-500/30 blur-md transition group-hover:bg-brand-500/40" />
          <DSIcon size={38} className="relative" />
        </div>
        <span className="font-display text-[16px] font-bold text-white">Detail Support</span>
      </Link>

      {/* Stepper */}
      <div className="mb-6 flex items-center">
        {["Account", "Business", "Plan"].map((label, i) => {
          const n = i + 1;
          const state = step > n ? "done" : step === n ? "cur" : "todo";
          return (
            <div key={label} className="flex flex-1 items-center gap-2.5 last:flex-none">
              <span
                className={cn(
                  "flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12.5px] font-bold transition-colors",
                  state === "done" && "bg-success text-white",
                  state === "cur" && "bg-brand-500 text-white ring-4 ring-brand-500/25",
                  state === "todo" && "bg-white/10 text-white/50"
                )}
              >
                {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
              </span>
              <span className={cn("text-[12.5px] font-semibold", step === n ? "text-white" : "text-white/50")}>{label}</span>
              {n < 3 && <span className={cn("mx-1 h-0.5 flex-1 rounded-full", step > n ? "bg-success" : "bg-white/15")} />}
            </div>
          );
        })}
      </div>

      <div className="auth-card rounded-[22px] p-6 sm:p-7">
        {!configured && (
          <div className="mb-4 rounded-xl bg-warning/15 px-3.5 py-3 text-[12.5px] text-amber-100 ring-1 ring-inset ring-warning/25">
            Authentication isn't configured — add your Supabase keys to <code className="text-amber-200">.env</code>.
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <StepHeading title="Create your account" subtitle="Your login details" />
            <AuthField label="Full name" icon={<User />}>
              <input className="auth-input has-icon" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Andy Pham" autoComplete="name" />
            </AuthField>
            <AuthField label="Email" icon={<Mail />}>
              <input className="auth-input has-icon" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </AuthField>
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField label="Password" icon={<Lock />}>
                <input className="auth-input has-icon" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" autoComplete="new-password" />
              </AuthField>
              <AuthField label="Confirm password" icon={<Lock />}>
                <input className="auth-input has-icon" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter" autoComplete="new-password" />
              </AuthField>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <StepHeading title="Business setup" subtitle="Tell us about your shop" />
            <AuthField label="Business name" icon={<Building2 />}>
              <input className="auth-input has-icon" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Shine Time Detailing" autoComplete="organization" />
            </AuthField>
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField label="Owner name" icon={<User />}>
                <input className="auth-input has-icon" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={fullName || "Owner"} />
              </AuthField>
              <AuthField label="Phone number" icon={<Phone />}>
                <input className="auth-input has-icon" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(214) 555-0134" autoComplete="tel" />
              </AuthField>
            </div>
            <AuthField label="Business email" icon={<AtSign />}>
              <input className="auth-input has-icon" type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="shop@example.com" />
            </AuthField>
            <AuthField label="Location" icon={<MapPin />}>
              <input className="auth-input has-icon" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Plano, TX" />
            </AuthField>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <StepHeading title="Choose your plan" subtitle="Start with a 14-day free trial — no card required" />
            <div className="flex items-center gap-2 rounded-xl bg-brand-500/15 px-3.5 py-2.5 text-[12.5px] font-medium text-brand-200 ring-1 ring-inset ring-brand-400/20">
              <span className="text-base">✨</span>
              Founding-member pricing — lock in this rate for life.
            </div>
            <div className="flex flex-col gap-2.5">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                    plan === p.id ? "border-brand-400/60 bg-brand-500/15" : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors",
                      plan === p.id ? "border-brand-400 bg-brand-500 text-white" : "border-white/25"
                    )}
                  >
                    {plan === p.id && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-semibold text-white">{p.name}</span>
                      {p.badge && (
                        <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[10.5px] font-semibold text-brand-200 ring-1 ring-inset ring-brand-400/20">
                          {p.badge}
                        </span>
                      )}
                      <span className="ml-auto text-[15px] font-bold tnum text-white">
                        {p.price}
                        <span className="text-[12px] font-medium text-white/50">{p.cadence}</span>
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-white/50">{p.features.join(" · ")}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mt-4 rounded-xl bg-danger/15 px-3.5 py-3 text-[12.5px] text-red-200 ring-1 ring-inset ring-danger/30">{error}</div>}
        {info && (
          <div className="mt-4 rounded-xl bg-success/15 px-3.5 py-3 text-[12.5px] text-emerald-200 ring-1 ring-inset ring-success/25">
            {info} <Link to="/login" className="font-semibold text-emerald-100 underline">Log in</Link>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2.5">
          {step > 1 ? (
            <button onClick={() => { setStep((s) => s - 1); setError(null); }} className="auth-btn-ghost inline-flex items-center gap-1.5 px-4">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <Link to="/welcome" className="auth-btn-ghost inline-flex items-center px-4">Cancel</Link>
          )}
          {step < 3 ? (
            <button onClick={next} disabled={!configured} className="auth-btn ml-auto !w-auto px-6">
              <span className="relative inline-flex items-center gap-2">Continue <ArrowRight className="h-4 w-4" /></span>
            </button>
          ) : (
            <button onClick={finish} disabled={busy || !configured} className="auth-btn ml-auto !w-auto px-6">
              <span className="relative inline-flex items-center gap-2">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create account & start trial"}
              </span>
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-[13px] text-white/55">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-300 transition hover:text-brand-200">Log in</Link>
      </p>
    </AuthShell>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="font-display text-[19px] font-bold tracking-tight text-white">{title}</h1>
      <p className="mt-0.5 text-[13px] text-white/55">{subtitle}</p>
    </div>
  );
}

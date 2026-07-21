import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, type Role } from "@/lib/models";

interface InviteInfo {
  org_id: string;
  org_name: string;
  role: Role;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_by_name: string | null;
}

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth form state (for logged-out invitees)
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) {
        setLoadErr("Authentication isn't configured.");
        setLoading(false);
        return;
      }
      if (!token) {
        setLoadErr("This invite link is missing its token.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("get_invitation", { p_token: token });
      if (!active) return;
      if (error) setLoadErr(error.message);
      else if (!data || (data as InviteInfo[]).length === 0)
        setLoadErr("We couldn't find this invitation. The link may be invalid.");
      else setInfo((data as InviteInfo[])[0]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const finishAccept = async () => {
    if (!supabase) return;
    const { error } = await supabase.rpc("accept_invitation", { p_token: token });
    if (error) throw new Error(error.message);
    // Full reload so the auth provider re-bootstraps into the joined workspace.
    window.location.assign("/");
  };

  const acceptAsCurrentUser = async () => {
    setBusy(true);
    setActionErr(null);
    try {
      await finishAccept();
    } catch (e) {
      setActionErr((e as Error).message);
      setBusy(false);
    }
  };

  const createAndAccept = async () => {
    if (!supabase || !info) return;
    setBusy(true);
    setActionErr(null);
    try {
      if (mode === "create") {
        if (!fullName.trim()) throw new Error("Enter your full name.");
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const { error } = await supabase.auth.signUp({
          email: info.email,
          password,
          options: { data: { full_name: fullName, invited: "true" } },
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: info.email,
          password,
        });
        if (error) throw new Error(error.message);
      }
      await finishAccept();
    } catch (e) {
      setActionErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px]"
      >
        <Link to="/welcome" className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white shadow-glow">
            D
          </div>
          <div>
            <div className="text-lg font-bold text-ink">Detail Support</div>
            <div className="text-[13px] text-ink3">Team invitation</div>
          </div>
        </Link>

        <div className="surface rounded-2xl p-6">
          {loading || authLoading ? (
            <div className="py-8 text-center text-[13px] text-ink3">Loading invitation…</div>
          ) : loadErr ? (
            <Notice kind="error" title="Invitation unavailable" body={loadErr} />
          ) : info && info.status !== "pending" ? (
            <Notice
              kind="error"
              title={`Invitation ${info.status}`}
              body={
                info.status === "accepted"
                  ? "This invitation has already been used."
                  : info.status === "revoked"
                    ? "This invitation was revoked by the shop owner."
                    : "This invitation has expired. Ask for a fresh invite."
              }
            />
          ) : info ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-[16px] font-semibold leading-tight">
                    Join {info.org_name}
                  </h1>
                  <p className="text-[13px] text-ink3">
                    {info.invited_by_name ? `${info.invited_by_name} invited you` : "You've been invited"}{" "}
                    as <b className="text-ink2">{ROLE_LABEL[info.role]}</b>
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-lg bg-panel2 px-3 py-2 text-[12.5px] text-ink2">
                Invitation for <b>{info.email}</b>
              </div>

              {isAuthenticated ? (
                user?.email?.toLowerCase() === info.email.toLowerCase() ? (
                  <>
                    <button
                      onClick={acceptAsCurrentUser}
                      disabled={busy}
                      className="h-11 w-full rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.06] hover:shadow-glow-lg active:scale-[0.98] disabled:opacity-50"
                    >
                      {busy ? "Joining…" : `Join ${info.org_name}`}
                    </button>
                    {actionErr && <ErrorLine msg={actionErr} />}
                  </>
                ) : (
                  <Notice
                    kind="warn"
                    title="Different account"
                    body={`You're signed in as ${user?.email}, but this invite is for ${info.email}.`}
                    action={
                      <button
                        onClick={() => logout()}
                        className="mt-3 h-10 w-full rounded-lg border border-line text-[13px] font-semibold text-ink2 hover:border-brand-500"
                      >
                        Log out to switch accounts
                      </button>
                    }
                  />
                )
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex rounded-lg bg-panel2 p-1 text-[12.5px] font-semibold">
                    {(["create", "signin"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMode(m);
                          setActionErr(null);
                        }}
                        className={
                          "flex-1 rounded-md py-1.5 transition-colors " +
                          (mode === m ? "bg-panel text-ink shadow-sm" : "text-ink3")
                        }
                      >
                        {m === "create" ? "Create account" : "I have an account"}
                      </button>
                    ))}
                  </div>

                  {mode === "create" && (
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.07em] text-ink2">
                        Full name
                      </span>
                      <input
                        className="input"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        autoComplete="name"
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.07em] text-ink2">
                      Email
                    </span>
                    <input className="input opacity-60" value={info.email} readOnly />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.07em] text-ink2">
                      Password
                    </span>
                    <input
                      className="input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "create" ? "8+ characters" : "Your password"}
                      autoComplete={mode === "create" ? "new-password" : "current-password"}
                    />
                  </label>

                  <button
                    onClick={createAndAccept}
                    disabled={busy}
                    className="h-11 w-full rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.06] hover:shadow-glow-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy
                      ? "Joining…"
                      : mode === "create"
                        ? `Create account & join`
                        : `Sign in & join`}
                  </button>
                  {actionErr && <ErrorLine msg={actionErr} />}
                </div>
              )}
            </>
          ) : null}
        </div>

        <p className="mt-4 text-center text-[13px] text-ink3">
          <Link to="/welcome" className="font-semibold text-brand-500">
            Back to Detail Support
          </Link>
        </p>
      </motion.div>

      <style>{`
        .input { height: 42px; width: 100%; border-radius: 8px; border: 1px solid rgb(var(--line));
          background: rgb(var(--panel-2)); color: rgb(var(--ink)); padding: 0 12px; font-size: 14px; font-family: inherit; }
        .input:focus { outline: none; border-color: #2E7BFF; box-shadow: 0 0 0 3px rgb(46 123 255 / 0.15); }
      `}</style>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <div className="mt-1 rounded-lg bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger">{msg}</div>
  );
}

function Notice({
  kind,
  title,
  body,
  action,
}: {
  kind: "error" | "warn";
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-2 text-center">
      <div
        className={
          "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl " +
          (kind === "error" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")
        }
      >
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="text-[15px] font-semibold">{title}</div>
      <div className="mx-auto mt-1 max-w-xs text-[13px] text-ink3">{body}</div>
      {action}
    </div>
  );
}

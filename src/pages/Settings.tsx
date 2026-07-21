import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CreditCard, UsersRound, UserRound, LogOut, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Modal";
import { Loading, SignInPrompt } from "@/components/ui/data";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useEntitlements } from "@/lib/entitlements";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, BILLING_STATUS_LABEL, type Role } from "@/lib/models";
import { cn } from "@/lib/cn";

export default function Settings() {
  const { ws, loading, ready, save } = useWorkspace();
  const ent = useEntitlements();
  const { user, role, logout } = useAuth();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ws) return;
    setName(ws.name ?? "");
    setOwnerName(ws.settings.owner_name ?? "");
    setPhone(ws.settings.phone ?? "");
    setBusinessEmail(ws.settings.business_email ?? "");
    setLocation(ws.settings.location ?? "");
  }, [ws]);

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await save({
        name,
        settings: {
          owner_name: ownerName,
          phone,
          business_email: businessEmail,
          location,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const planInfo = ent.planInfo(ent.subscriptionPlan);
  const planName = planInfo?.name ?? "Free";
  const priceText = ent.monthlyPrice > 0 ? `$${ent.monthlyPrice} /month` : "$0";
  const trialDays = ent.trialDaysLeft;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Settings" subtitle="Your workspace, plan, and team" />

      {!ready ? (
        <SignInPrompt what="workspace settings" />
      ) : loading || !ws ? (
        <Loading />
      ) : (
        <div className="mx-auto max-w-2xl divide-y divide-line">
          {/* Business profile */}
          <Panel title="Business profile" subtitle="Used across your workspace" className="pb-9">
            <div className="flex flex-col gap-4">
              <Field label="Business name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Owner name">
                  <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business email">
                  <input className="input" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
                </Field>
                <Field label="Location">
                  <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
              </div>
              {error && <div className="text-[12.5px] text-danger">{error}</div>}
              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={saveProfile} disabled={busy || !name.trim()}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-[13px] font-medium text-success">
                    <Check className="h-4 w-4" /> Saved
                  </span>
                )}
              </div>
            </div>
          </Panel>

          {/* Plan */}
          <Panel title="Plan & billing" className="py-9">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold">{planName} plan</span>
                  {ent.ready && (
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-500">
                      {BILLING_STATUS_LABEL[ent.status]}
                    </span>
                  )}
                  {ent.foundingMember && (
                    <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[10.5px] font-semibold text-violet">
                      Founding member
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] text-ink3">
                  {priceText}
                  {trialDays !== null && trialDays > 0 && ` · ${trialDays} days left in trial`}
                </div>
              </div>
              <Link
                to="/billing"
                className="ml-auto inline-flex h-[38px] items-center gap-2 rounded-lg border border-line bg-panel px-[15px] text-[13px] font-semibold text-ink hover:border-brand-500"
              >
                Manage billing
              </Link>
            </div>
          </Panel>

          {/* Team */}
          <Panel title="Team" className="py-9">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet/10 text-violet">
                <UsersRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[14px] font-semibold">You</div>
                <div className="text-[12.5px] text-ink3">
                  {ROLE_LABEL[(role as Role) ?? "owner"] ?? "Owner"}
                </div>
              </div>
              <Link
                to="/team"
                className="ml-auto inline-flex h-[38px] items-center gap-2 rounded-lg border border-line bg-panel px-[15px] text-[13px] font-semibold text-ink hover:border-ink3"
              >
                {role === "employee" ? "View team" : "Manage team"}
              </Link>
            </div>
          </Panel>

          {/* Account */}
          <Panel title="Account" className="py-9">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/10 text-[13px] font-bold uppercase text-brand-500">
                {(user?.email ?? "D").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                  <UserRound className="h-4 w-4 text-ink3" />
                  {user?.email ?? "—"}
                </div>
              </div>
              <button
                onClick={() => logout()}
                className={cn(
                  "ml-auto inline-flex h-[38px] items-center gap-2 rounded-lg border border-line px-4 text-[13px] font-semibold text-ink2",
                  "hover:border-danger hover:text-danger"
                )}
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </Panel>

          <div className="flex items-center gap-2 py-6 text-[12px] text-ink3">
            <Building2 className="h-3.5 w-3.5" />
            Detail Support · workspace {ws.id.slice(0, 8)}
          </div>
        </div>
      )}
    </div>
  );
}

/** A borderless settings section: heading (+ optional subtitle), then content. */
function Panel({ title, subtitle, className, children }: {
  title: string; subtitle?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-3">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink3">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

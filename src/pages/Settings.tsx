import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2, Palette, UsersRound, Percent, Bell, Contrast, Sparkles,
  CreditCard, CalendarDays, Puzzle, ShieldCheck, Wallet, Check, Sun, Moon,
  LogOut, ArrowRight, Star, Mail, KeyRound, DollarSign, ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Modal";
import { SignInPrompt } from "@/components/ui/data";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { DSIcon } from "@/components/brand/Logo";
import { useWorkspace, type WorkspaceSettings } from "@/hooks/useWorkspace";
import { useEntitlements } from "@/lib/entitlements";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/demo";
import { BILLING_STATUS_LABEL, ROLE_LABEL, type Role } from "@/lib/models";
import { cn } from "@/lib/cn";

type Tone = "brand" | "violet" | "success" | "warning" | "danger";
const BUBBLE: Record<Tone, string> = {
  brand: "bg-brand-500/12 text-brand-500",
  violet: "bg-violet/12 text-violet",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
};

interface SectionDef { key: string; label: string; icon: LucideIcon }
const SECTIONS: SectionDef[] = [
  { key: "profile", label: "Business Profile", icon: Building2 },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "team", label: "Team", icon: UsersRound },
  { key: "taxes", label: "Taxes", icon: Percent },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "appearance", label: "Appearance", icon: Contrast },
  { key: "ai", label: "AI Preferences", icon: Sparkles },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "integrations", label: "Integrations", icon: Puzzle },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "billing", label: "Billing", icon: Wallet },
];

export default function Settings() {
  const { ws, loading, ready, save } = useWorkspace();
  const ent = useEntitlements();
  const { user, role, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  const [active, setActive] = useState("profile");
  const [name, setName] = useState("");
  const [s, setS] = useState<WorkspaceSettings>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ws) return;
    setName(ws.name ?? "");
    setS(ws.settings ?? {});
  }, [ws]);

  const set = (patch: Partial<WorkspaceSettings>) => setS((prev) => ({ ...prev, ...patch }));

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2200); };

  const persist = async (patch: Partial<WorkspaceSettings>, orgName?: string) => {
    setBusy(true);
    setError(null);
    try {
      await save({ name: orgName, settings: patch });
      flash();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Optimistic toggle: flip locally, then persist just that key.
  const toggle = (key: keyof WorkspaceSettings) => {
    const v = !s[key];
    set({ [key]: v } as Partial<WorkspaceSettings>);
    persist({ [key]: v } as Partial<WorkspaceSettings>);
  };

  const planInfo = ent.planInfo(ent.subscriptionPlan);
  const planName = planInfo?.name ?? "Free";
  const priceText = ent.monthlyPrice > 0 ? `$${ent.monthlyPrice} /month` : "$0";
  const trialDays = ent.trialDaysLeft;

  if (!ready) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Settings" subtitle="Your business control center" />
        <SignInPrompt what="workspace settings" />
      </div>
    );
  }
  if (loading || !ws) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Settings" subtitle="Your business control center" />
        <PageSkeleton variant="plain" header={false} />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Settings" subtitle="Your business control center — everything about how your shop runs, in one place." />

      <div className="grid gap-6 lg:grid-cols-[248px_1fr]">
        {/* Section navigation */}
        <nav className="min-w-0 lg:sticky lg:top-[76px] lg:self-start">
          <div className="scrollbar-slim -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
            {SECTIONS.map((sec) => {
              const on = active === sec.key;
              return (
                <button
                  key={sec.key}
                  onClick={() => setActive(sec.key)}
                  className={cn(
                    "group flex flex-none items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors lg:w-full",
                    on ? "bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20" : "text-ink2 hover:bg-line2 hover:text-ink"
                  )}
                >
                  <sec.icon className={cn("h-[18px] w-[18px] flex-none", on ? "text-brand-500" : "text-ink3 group-hover:text-ink2")} />
                  {sec.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active section */}
        <div className="min-w-0">
          {/* Saved / error banner */}
          <div className="mb-3 flex h-5 items-center">
            {saved && <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-success"><Check className="h-4 w-4" /> Changes saved</span>}
            {error && <span className="text-[12.5px] font-medium text-danger">{error}</span>}
          </div>

          <div className="flex flex-col gap-6">
            {/* ---- BUSINESS PROFILE ---- */}
            {active === "profile" && (
              <SettingCard icon={Building2} title="Business profile" desc="Your shop's core details — used across invoices, quotes and your booking page.">
                <div className="flex flex-col gap-4">
                  <Field label="Business name">
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Owner name">
                      <input className="input" value={s.owner_name ?? ""} onChange={(e) => set({ owner_name: e.target.value })} />
                    </Field>
                    <Field label="Phone">
                      <input className="input" value={s.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Business email">
                      <input className="input" value={s.business_email ?? ""} onChange={(e) => set({ business_email: e.target.value })} />
                    </Field>
                    <Field label="Location">
                      <input className="input" value={s.location ?? ""} onChange={(e) => set({ location: e.target.value })} />
                    </Field>
                  </div>
                  <SaveButton busy={busy} disabled={!name.trim()}
                    onClick={() => persist({ owner_name: s.owner_name, phone: s.phone, business_email: s.business_email, location: s.location }, name)} />
                </div>
              </SettingCard>
            )}

            {/* ---- BRANDING ---- */}
            {active === "branding" && (
              <SettingCard icon={Palette} tone="violet" title="Branding" desc="How your shop shows up on invoices, quotes and your booking page.">
                <div className="flex items-center gap-4 rounded-xl bg-panel2/50 p-4 ring-1 ring-inset ring-line/60">
                  <DSIcon size={44} />
                  <div className="min-w-0">
                    <div className="truncate font-display text-[15px] font-bold text-ink">{name || "Your business"}</div>
                    <div className="truncate text-[12.5px] text-ink3">{s.tagline || "Add a tagline below"}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-4">
                  <Field label="Tagline">
                    <input className="input" placeholder="Showroom shine, every time." value={s.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} />
                  </Field>
                  <div className="flex items-center justify-between rounded-xl bg-panel2/40 px-4 py-3 ring-1 ring-inset ring-line/60">
                    <div>
                      <div className="text-[13px] font-semibold text-ink">Custom logo upload</div>
                      <div className="text-[12px] text-ink3">Bring your own mark for invoices and emails.</div>
                    </div>
                    <span className="rounded-full bg-line2 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">Coming soon</span>
                  </div>
                  <SaveButton busy={busy} onClick={() => persist({ tagline: s.tagline })} />
                </div>
              </SettingCard>
            )}

            {/* ---- TEAM ---- */}
            {active === "team" && (
              <SettingCard icon={UsersRound} tone="violet" title="Team" desc="Invite detailers, set roles, and assign work."
                action={<LinkBtn to="/team">{role === "employee" ? "View team" : "Manage team"}</LinkBtn>}>
                <RowItem
                  bubble={<span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-[13px] font-bold uppercase text-brand-500">{(user?.email ?? "D").slice(0, 2)}</span>}
                  title="You" sub={ROLE_LABEL[(role as Role) ?? "owner"] ?? "Owner"} />
                <p className="mt-3 text-[12.5px] text-ink3">Add teammates and control who can see revenue, manage customers, or just their own jobs — all from the Team page.</p>
              </SettingCard>
            )}

            {/* ---- TAXES ---- */}
            {active === "taxes" && (
              <SettingCard icon={Percent} tone="success" title="Taxes" desc="Set your default tax so it's applied consistently on quotes and invoices.">
                <ToggleRow label="Charge tax" desc="Apply tax to new invoices and quotes by default." checked={Boolean(s.tax_enabled)} onChange={() => toggle("tax_enabled")} />
                <div className={cn("mt-4 grid gap-4 sm:grid-cols-2", !s.tax_enabled && "pointer-events-none opacity-50")}>
                  <Field label="Tax label">
                    <input className="input" placeholder="Sales tax" value={s.tax_label ?? ""} onChange={(e) => set({ tax_label: e.target.value })} />
                  </Field>
                  <Field label="Tax rate (%)">
                    <input className="input" type="number" step="0.01" min="0" value={s.tax_rate ?? ""} onChange={(e) => set({ tax_rate: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                </div>
                <SaveButton className="mt-4" busy={busy} onClick={() => persist({ tax_label: s.tax_label, tax_rate: s.tax_rate })} />
              </SettingCard>
            )}

            {/* ---- NOTIFICATIONS ---- */}
            {active === "notifications" && (
              <SettingCard icon={Bell} tone="warning" title="Notifications" desc="Choose what you and your customers get pinged about.">
                <div className="flex flex-col divide-y divide-line2">
                  <ToggleRow label="New booking alerts" desc="Get notified the moment a customer books." checked={Boolean(s.notif_new_booking)} onChange={() => toggle("notif_new_booking")} />
                  <ToggleRow label="Appointment reminders" desc="Automatic reminders before each appointment." checked={Boolean(s.notif_reminders)} onChange={() => toggle("notif_reminders")} />
                  <ToggleRow label="Review requests" desc="Ask happy customers for a review after a job." checked={Boolean(s.notif_review_requests)} onChange={() => toggle("notif_review_requests")} />
                  <ToggleRow label="Payment receipts" desc="Email a receipt when an invoice is paid." checked={Boolean(s.notif_payment)} onChange={() => toggle("notif_payment")} />
                  <ToggleRow label="SMS notifications" desc="Send text updates in addition to email." checked={Boolean(s.notif_sms)} onChange={() => toggle("notif_sms")} />
                </div>
              </SettingCard>
            )}

            {/* ---- APPEARANCE ---- */}
            {active === "appearance" && (
              <SettingCard icon={Contrast} title="Appearance" desc="Pick the look that's easiest on your eyes. Applies to this device.">
                <div className="grid grid-cols-2 gap-3">
                  <ThemeTile active={theme === "light"} onClick={() => theme !== "light" && toggleTheme()} icon={Sun} label="Light" />
                  <ThemeTile active={theme === "dark"} onClick={() => theme !== "dark" && toggleTheme()} icon={Moon} label="Dark" />
                </div>
              </SettingCard>
            )}

            {/* ---- AI PREFERENCES ---- */}
            {active === "ai" && (
              <SettingCard icon={Sparkles} tone="violet" title="AI preferences" desc="Control the data-driven suggestions that appear around the app.">
                <div className="flex flex-col divide-y divide-line2">
                  <ToggleRow label="Customer recommendations" desc="Show next-best-actions on customer profiles." checked={Boolean(s.ai_recommendations)} onChange={() => toggle("ai_recommendations")} />
                  <ToggleRow label="Business coach" desc="Surface growth ideas on your dashboard." checked={Boolean(s.ai_business_coach)} onChange={() => toggle("ai_business_coach")} />
                </div>
                <p className="mt-4 rounded-xl bg-panel2/50 px-4 py-3 text-[12px] leading-relaxed text-ink3 ring-1 ring-inset ring-line/60">
                  These suggestions are generated from your own shop data — no data leaves your workspace. The Gear Guide chat assistant is separate and requires an Anthropic API key on the server.
                </p>
              </SettingCard>
            )}

            {/* ---- PAYMENTS ---- */}
            {active === "payments" && (
              <SettingCard icon={CreditCard} tone="success" title="Payments" desc="Defaults for how you collect deposits and bill customers.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Default deposit (%)">
                    <input className="input" type="number" min="0" max="100" value={s.pay_deposit_pct ?? ""} onChange={(e) => set({ pay_deposit_pct: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                  <Field label="Payment terms (days)">
                    <input className="input" type="number" min="0" value={s.pay_terms_days ?? ""} onChange={(e) => set({ pay_terms_days: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Invoice footer note">
                    <textarea className="input" rows={2} placeholder="Thank you for your business!" value={s.pay_footer ?? ""} onChange={(e) => set({ pay_footer: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-panel2/40 px-4 py-3 text-[12.5px] text-ink3 ring-1 ring-inset ring-line/60">
                  <DollarSign className="h-4 w-4 flex-none text-ink3" />
                  Card processing is handled through <Link to="/billing" className="mx-1 font-semibold text-brand-500">Stripe billing</Link>.
                </div>
                <SaveButton className="mt-4" busy={busy} onClick={() => persist({ pay_deposit_pct: s.pay_deposit_pct, pay_terms_days: s.pay_terms_days, pay_footer: s.pay_footer })} />
              </SettingCard>
            )}

            {/* ---- CALENDAR ---- */}
            {active === "calendar" && (
              <SettingCard icon={CalendarDays} title="Calendar" desc="How your schedule and new appointments behave by default.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Default appointment length (min)">
                    <input className="input" type="number" min="15" step="15" value={s.cal_default_duration ?? ""} onChange={(e) => set({ cal_default_duration: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                  <div>
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">Week starts on</span>
                    <div className="flex gap-2">
                      <Segment active={(s.cal_week_start ?? "sun") === "sun"} onClick={() => { set({ cal_week_start: "sun" }); persist({ cal_week_start: "sun" }); }}>Sunday</Segment>
                      <Segment active={s.cal_week_start === "mon"} onClick={() => { set({ cal_week_start: "mon" }); persist({ cal_week_start: "mon" }); }}>Monday</Segment>
                    </div>
                  </div>
                  <Field label="Opens at">
                    <input className="input" type="time" value={s.cal_open ?? ""} onChange={(e) => set({ cal_open: e.target.value })} />
                  </Field>
                  <Field label="Closes at">
                    <input className="input" type="time" value={s.cal_close ?? ""} onChange={(e) => set({ cal_close: e.target.value })} />
                  </Field>
                </div>
                <SaveButton className="mt-4" busy={busy} onClick={() => persist({ cal_default_duration: s.cal_default_duration, cal_open: s.cal_open, cal_close: s.cal_close })} />
              </SettingCard>
            )}

            {/* ---- INTEGRATIONS ---- */}
            {active === "integrations" && (
              <SettingCard icon={Puzzle} title="Integrations" desc="Connect the tools your shop already uses.">
                <div className="flex flex-col gap-2.5">
                  <IntegrationRow icon={Star} tone="warning" name="Google Reviews" desc="Pull in and reply to your Google reviews." to="/reviews" cta="Set up" />
                  <IntegrationRow icon={CreditCard} tone="brand" name="Stripe" desc="Subscription billing and card payments." to="/billing" cta="Manage" />
                  <IntegrationRow icon={Wallet} tone="success" name="QuickBooks" desc="Sync invoices with your accounting." soon />
                  <IntegrationRow icon={Puzzle} tone="violet" name="Zapier" desc="Automate workflows with 6,000+ apps." soon />
                </div>
              </SettingCard>
            )}

            {/* ---- SECURITY ---- */}
            {active === "security" && (
              <SettingCard icon={ShieldCheck} tone="danger" title="Security" desc="Protect access to your workspace.">
                <RowItem bubble={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel2 text-ink3"><Mail className="h-5 w-5" /></span>}
                  title={user?.email ?? "—"} sub="Account email" />
                <div className="mt-4 flex flex-col gap-2.5">
                  <PasswordReset email={user?.email ?? null} />
                  <button onClick={() => logout()} className="flex items-center justify-between rounded-xl bg-panel2/50 px-4 py-3 text-left ring-1 ring-inset ring-line/60 transition-colors hover:bg-line2">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10 text-danger"><LogOut className="h-4 w-4" /></span>
                      <span><span className="block text-[13px] font-semibold text-ink">Log out</span><span className="block text-[12px] text-ink3">Sign out of this device.</span></span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink3" />
                  </button>
                </div>
              </SettingCard>
            )}

            {/* ---- BILLING ---- */}
            {active === "billing" && (
              <SettingCard icon={Wallet} title="Billing" desc="Your plan, invoices and payment method."
                action={<LinkBtn to="/billing">Manage billing</LinkBtn>}>
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-panel2/50 p-4 ring-1 ring-inset ring-line/60">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><CreditCard className="h-5 w-5" /></span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold text-ink">{planName} plan</span>
                      {ent.ready && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-500">{BILLING_STATUS_LABEL[ent.status]}</span>}
                      {ent.foundingMember && <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[10.5px] font-semibold text-violet">Founding member</span>}
                    </div>
                    <div className="text-[12.5px] text-ink3">{priceText}{trialDays !== null && trialDays > 0 && ` · ${trialDays} days left in trial`}</div>
                  </div>
                </div>
              </SettingCard>
            )}
          </div>

          <div className="mt-6 flex items-center gap-2 text-[11.5px] text-ink3">
            <Building2 className="h-3.5 w-3.5" />
            Detail Support · workspace {ws.id.slice(0, 8)}{isDemo() && " · demo (changes aren't saved)"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function SettingCard({ icon: Icon, tone = "brand", title, desc, action, children }: {
  icon: LucideIcon; tone?: Tone; title: string; desc: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="surface relative overflow-hidden rounded-[20px]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-paint-gloss opacity-25" />
      <div className="relative p-5 sm:p-7">
        <div className="mb-5 flex items-start gap-3.5">
          <span className={cn("flex h-11 w-11 flex-none items-center justify-center rounded-2xl", BUBBLE[tone])}>
            <Icon className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-bold tracking-tight text-ink">{title}</h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink3">{desc}</p>
          </div>
          {action && <div className="hidden flex-none sm:block">{action}</div>}
        </div>
        {children}
        {action && <div className="mt-5 sm:hidden">{action}</div>}
      </div>
    </section>
  );
}

function SaveButton({ busy, disabled, onClick, className }: { busy: boolean; disabled?: boolean; onClick: () => void; className?: string }) {
  return (
    <div className={className}>
      <Button variant="primary" onClick={onClick} disabled={busy || disabled}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className={cn("relative h-6 w-11 flex-none rounded-full transition-colors duration-200", checked ? "bg-brand-500" : "bg-line2")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-ink">{label}</div>
        <div className="text-[12px] leading-relaxed text-ink3">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function RowItem({ bubble, title, sub }: { bubble: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      {bubble}
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ink">{title}</div>
        <div className="truncate text-[12.5px] text-ink3">{sub}</div>
      </div>
    </div>
  );
}

function LinkBtn({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-panel px-4 text-[13px] font-semibold text-ink transition-colors hover:border-brand-500 sm:w-auto">
      {children}<ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function ThemeTile({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button onClick={onClick} className={cn(
      "flex items-center gap-3 rounded-xl px-4 py-4 ring-1 ring-inset transition-colors",
      active ? "bg-brand-500/[0.08] ring-brand-500/40" : "bg-panel2/40 ring-line/60 hover:ring-ink3/40"
    )}>
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-brand-500 text-white" : "bg-line2 text-ink3")}><Icon className="h-5 w-5" /></span>
      <span className="text-[14px] font-semibold text-ink">{label}</span>
      {active && <Check className="ml-auto h-5 w-5 text-brand-500" />}
    </button>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn(
      "h-11 flex-1 rounded-lg text-[13px] font-semibold ring-1 ring-inset transition-colors md:h-10",
      active ? "bg-brand-500/10 text-brand-500 ring-brand-500/30" : "bg-panel2/40 text-ink2 ring-line/60 hover:text-ink"
    )}>{children}</button>
  );
}

function IntegrationRow({ icon: Icon, tone, name, desc, to, cta, soon }: {
  icon: LucideIcon; tone: Tone; name: string; desc: string; to?: string; cta?: string; soon?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl bg-panel2/50 px-4 py-3 ring-1 ring-inset ring-line/60">
      <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-xl", BUBBLE[tone])}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-ink">{name}</div>
        <div className="truncate text-[12px] text-ink3">{desc}</div>
      </div>
      {soon ? (
        <span className="flex-none rounded-full bg-line2 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">Soon</span>
      ) : (
        <Link to={to!} className="inline-flex min-h-[36px] flex-none items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/15">
          {cta}<ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function PasswordReset({ email }: { email: string | null }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const send = async () => {
    if (!email) return;
    if (isDemo() || !supabase) { setState("sent"); return; }
    setState("sending");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
      setState(error ? "error" : "sent");
    } catch {
      setState("error");
    }
  };
  return (
    <button onClick={send} disabled={state === "sending" || state === "sent"}
      className="flex items-center justify-between rounded-xl bg-panel2/50 px-4 py-3 text-left ring-1 ring-inset ring-line/60 transition-colors hover:bg-line2 disabled:opacity-70">
      <span className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><KeyRound className="h-4 w-4" /></span>
        <span>
          <span className="block text-[13px] font-semibold text-ink">Change password</span>
          <span className="block text-[12px] text-ink3">
            {state === "sent" ? "Reset link sent — check your email." : state === "error" ? "Couldn't send — try again." : "We'll email you a secure reset link."}
          </span>
        </span>
      </span>
      {state === "sent" ? <Check className="h-4 w-4 text-success" /> : <ArrowRight className="h-4 w-4 text-ink3" />}
    </button>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Phone, Mail, MapPin, X, Loader2, ArrowLeft, ArrowRight,
  CheckCircle2, Check, Pencil, Eye, Car, CalendarPlus, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CustomerInput } from "@/hooks/useCustomers";
import type { Customer } from "@/lib/models";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "ds-add-customer-draft";
const STEP_COUNT = 5;

/** The wizard's working state — address is captured in parts here and composed
 *  into the single `address` string the backend expects only on save. */
type Draft = {
  name: string; phone: string; email: string;
  street: string; city: string; state: string; zip: string;
  notes: string;
};
const EMPTY: Draft = { name: "", phone: "", email: "", street: "", city: "", state: "", zip: "", notes: "" };

/** Progressive US phone formatting while typing: 2145550142 → (214) 555-0142. */
function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Compose the four address parts into one line: "123 Main St, Plano, TX 75024". */
function joinAddress(d: Draft): string {
  const cityState = [d.city.trim(), [d.state.trim().toUpperCase(), d.zip.trim()].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
  return [d.street.trim(), cityState].filter(Boolean).join(", ");
}

const clampStep = (n: number) => Math.max(0, Math.min(STEP_COUNT - 1, n));

/**
 * "Add Customer" — a guided, one-question-at-a-time onboarding flow rather than
 * a wall of fields. Five focused steps (name → contact → address → notes →
 * review) with a progress bar, back/skip, slide transitions, live formatting and
 * validation, and a success hand-off. The record is created once, on the final
 * confirmation; in-progress input is stashed in sessionStorage so closing the
 * modal never loses work. Same props/contract as before — drop-in.
 */
export function AddCustomerModal({ open, onClose, create }: {
  open: boolean;
  onClose: () => void;
  create: (input: CustomerInput) => Promise<Customer>;
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<Customer | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const saveDraft = (d: Draft, s: number) => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ d, s })); } catch { /* ignore quota/private-mode */ }
  };
  const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

  // On open: restore any saved progress, otherwise start fresh.
  useEffect(() => {
    if (!open) return;
    setBusy(false); setServerError(null); setCreated(null); setTried(false); setDir(1);
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const { d, s } = JSON.parse(raw) as { d: Draft; s: number };
        setDraft({ ...EMPTY, ...d }); setStep(clampStep(s ?? 0)); return;
      }
    } catch { /* fall through to fresh */ }
    setDraft(EMPTY); setStep(0);
  }, [open]);

  if (!open) return null;

  const set = (patch: Partial<Draft>) =>
    setDraft((d) => { const n = { ...d, ...patch }; saveDraft(n, step); return n; });

  const goto = (n: number, direction: number) => {
    const s = clampStep(n);
    setDir(direction); setTried(false); setServerError(null); setStep(s); saveDraft(draft, s);
  };

  const emailValid = !draft.email || EMAIL_RE.test(draft.email);
  const emailOk = Boolean(draft.email && emailValid);
  const nameError = step === 0 && tried && !draft.name.trim() ? "Enter the customer's name" : null;
  const emailError = step === 1 && tried && draft.email && !emailValid ? "That email doesn't look right" : null;

  const fail = () => setTried(true);

  const doCreate = async () => {
    setBusy(true); setServerError(null);
    try {
      const c = await create({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        address: joinAddress(draft),
        notes: draft.notes.trim(),
      });
      clearDraft();
      setCreated(c);
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || created) return;
    if (step === 4) { void doCreate(); return; }
    if (step === 0 && !draft.name.trim()) { fail(); return; }
    if (step === 1 && draft.email && !emailValid) { fail(); return; }
    goto(step + 1, 1);
  };

  const close = () => { if (!busy) onClose(); };

  // Esc closes; Tab wraps focus inside the dialog.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !busy) { e.preventDefault(); close(); return; }
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const items = Array.from(nodes).filter((n) => n.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const optional = step === 2 || step === 3;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
        className="fixed inset-0 bg-carbon-950/60 backdrop-blur-sm" onClick={close} />

      <motion.div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby="add-cust-title"
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="surface surface-raised relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden rounded-none sm:my-auto sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-[560px] sm:rounded-3xl"
      >
        {created ? (
          <SuccessView customer={created} onClose={onClose} navigate={navigate} />
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            {/* Progress header */}
            <div className="flex flex-none items-center gap-3 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-7 sm:pt-6">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-brand-500">Step {step + 1} of {STEP_COUNT}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line2">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-300 ease-out"
                    style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }} />
                </div>
              </div>
              <button type="button" onClick={close} aria-label="Close"
                className="-mr-1 mt-5 flex h-9 w-9 flex-none items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-line2 hover:text-ink active:scale-90">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* Step body */}
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:min-h-[340px] sm:px-7">
              <motion.div
                key={step}
                custom={dir}
                variants={stepVariants}
                initial="enter" animate="center"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                  <fieldset disabled={busy} className="min-w-0 border-0 p-0">
                      {step === 0 && (
                        <StepShell title="What's your customer's name?" sub="It's the only thing we really need to get started.">
                          <BigInput autoFocus icon={User} value={draft.name} onChange={(v) => set({ name: v })}
                            placeholder="John Smith" error={nameError} aria-label="Customer name" />
                          <AnimatePresence>
                            {nameError && (
                              <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                className="mt-2 overflow-hidden text-[12.5px] font-medium text-danger">{nameError}</motion.p>
                            )}
                          </AnimatePresence>
                        </StepShell>
                      )}

                      {step === 1 && (
                        <StepShell title="How can you reach them?" sub="Add a phone, an email, or both — all optional.">
                          <div className="flex flex-col gap-4">
                            <Labeled label="Phone" optional>
                              <BigInput autoFocus icon={Phone} inputMode="tel" value={draft.phone}
                                onChange={(v) => set({ phone: formatPhone(v) })} placeholder="(214) 555-0142" aria-label="Phone number" />
                            </Labeled>
                            <Labeled label="Email" optional error={emailError}>
                              <BigInput icon={Mail} type="email" inputMode="email" value={draft.email}
                                onChange={(v) => set({ email: v })} placeholder="john@example.com" error={emailError}
                                trailing={emailOk ? <CheckCircle2 className="h-5 w-5 text-success" aria-label="Valid email" /> : undefined}
                                aria-label="Email address" />
                            </Labeled>
                          </div>
                        </StepShell>
                      )}

                      {step === 2 && (
                        <StepShell title="Where are they located?" sub="Handy for planning mobile routes. Totally optional.">
                          <div className="flex flex-col gap-4">
                            <Labeled label="Street address" optional>
                              <BigInput autoFocus icon={MapPin} value={draft.street} onChange={(v) => set({ street: v })}
                                placeholder="123 Main St" aria-label="Street address" />
                            </Labeled>
                            <Labeled label="City" optional>
                              <BigInput value={draft.city} onChange={(v) => set({ city: v })} placeholder="Plano" aria-label="City" />
                            </Labeled>
                            <div className="grid grid-cols-[1fr_1.4fr] gap-3">
                              <Labeled label="State" optional>
                                <BigInput value={draft.state} onChange={(v) => set({ state: v.slice(0, 2).toUpperCase() })}
                                  placeholder="TX" aria-label="State" />
                              </Labeled>
                              <Labeled label="ZIP" optional>
                                <BigInput inputMode="numeric" value={draft.zip}
                                  onChange={(v) => set({ zip: v.replace(/\D/g, "").slice(0, 5) })} placeholder="75024" aria-label="ZIP code" />
                              </Labeled>
                            </div>
                          </div>
                        </StepShell>
                      )}

                      {step === 3 && (
                        <StepShell title="Anything worth remembering?" sub="Preferred service, vehicle details, gate codes, special requests…">
                          <textarea autoFocus rows={5} value={draft.notes} onChange={(e) => set({ notes: e.target.value })}
                            placeholder="e.g. Prefers weekend mornings. Black Tesla Model 3 — ceramic coating renewal due in spring."
                            aria-label="Customer notes"
                            className="w-full resize-none rounded-2xl border border-line bg-panel2 px-4 py-3.5 text-[16px] leading-relaxed text-ink outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink3/60 focus:border-brand-500 focus:bg-panel focus:shadow-[0_0_0_3px_rgb(46_123_255_/_0.16)]" />
                        </StepShell>
                      )}

                      {step === 4 && (
                        <StepShell title="Does this look right?" sub="Review the details, then create the customer.">
                          <div className="overflow-hidden rounded-2xl border border-line">
                            <ReviewRow label="Name" value={draft.name.trim() || "—"} onEdit={() => goto(0, -1)} />
                            <ReviewRow label="Contact"
                              value={[draft.phone.trim(), draft.email.trim()].filter(Boolean).join(" · ") || "None added"}
                              muted={!draft.phone.trim() && !draft.email.trim()} onEdit={() => goto(1, -1)} />
                            <ReviewRow label="Address" value={joinAddress(draft) || "None added"}
                              muted={!joinAddress(draft)} onEdit={() => goto(2, -1)} />
                            <ReviewRow label="Notes" value={draft.notes.trim() || "None added"}
                              muted={!draft.notes.trim()} onEdit={() => goto(3, -1)} last />
                          </div>
                          <AnimatePresence>
                            {serverError && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                className="mt-3 overflow-hidden">
                                <div className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[12.5px] font-medium text-danger ring-1 ring-inset ring-danger/20">{serverError}</div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </StepShell>
                      )}
                  </fieldset>
              </motion.div>
            </div>

            {/* Footer nav */}
            <div className="flex flex-none items-center gap-2.5 border-t border-line px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-7">
              {step === 0 ? (
                <button type="button" onClick={close} disabled={busy}
                  className="inline-flex h-12 items-center justify-center rounded-xl px-4 text-[13.5px] font-semibold text-ink3 transition-colors hover:bg-line2 hover:text-ink active:scale-[0.98] disabled:opacity-50">
                  Cancel
                </button>
              ) : (
                <button type="button" onClick={() => goto(step - 1, -1)} disabled={busy}
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13.5px] font-semibold text-ink2 transition-colors hover:bg-line2 hover:text-ink active:scale-[0.98] disabled:opacity-50">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}

              <div className="ml-auto flex items-center gap-2.5">
                {optional && (
                  <button type="button" onClick={() => goto(step + 1, 1)} disabled={busy}
                    className="inline-flex h-12 items-center justify-center rounded-xl px-3.5 text-[13.5px] font-semibold text-ink3 transition-colors hover:bg-line2 hover:text-ink active:scale-[0.98] disabled:opacity-50">
                    Skip
                  </button>
                )}
                <button type="submit" disabled={busy}
                  className="group relative inline-flex h-12 min-w-[150px] items-center justify-center gap-2 overflow-hidden rounded-xl border border-brand-600/60 bg-gradient-to-b from-brand-400 to-brand-600 px-6 text-[14.5px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-glow-lg hover:brightness-[1.05] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80">
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                  {busy ? (<><Loader2 className="relative h-4 w-4 animate-spin" /> Creating…</>)
                    : step === 4 ? (<><Check className="relative h-4 w-4" /> Create Customer</>)
                      : (<>Continue <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
                </button>
              </div>
            </div>
          </form>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ parts */

const stepVariants = {
  enter: (d: number) => ({ opacity: 0, x: d >= 0 ? 36 : -36 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d >= 0 ? -36 : 36 }),
};

function StepShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="pb-2 pt-2 sm:pt-4">
      <h2 id="add-cust-title" className="font-display text-[22px] font-bold leading-tight tracking-tight text-ink sm:text-[24px]">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink3">{sub}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Labeled({ label, optional, error, children }: { label: string; optional?: boolean; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
        {label}{optional && <span className="font-normal text-ink3">(Optional)</span>}
      </div>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 overflow-hidden text-[12px] font-medium text-danger">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function BigInput({ icon: Icon, value, onChange, placeholder, error, trailing, type = "text", inputMode, autoFocus, "aria-label": ariaLabel }: {
  icon?: LucideIcon; value: string; onChange: (v: string) => void; placeholder?: string;
  error?: string | null; trailing?: ReactNode; type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric"; autoFocus?: boolean; "aria-label"?: string;
}) {
  return (
    <div className="relative">
      {Icon && <Icon aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink3" />}
      <input
        autoFocus={autoFocus}
        type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="off" aria-label={ariaLabel} aria-invalid={Boolean(error)}
        className={cn(
          "h-14 w-full rounded-2xl border bg-panel2 text-[16px] text-ink outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink3/60",
          Icon ? "pl-12" : "pl-4", trailing ? "pr-11" : "pr-4",
          error
            ? "border-danger/55 focus:border-danger focus:shadow-[0_0_0_3px_rgb(229_72_77_/_0.15)]"
            : "border-line hover:border-ink3/50 focus:border-brand-500 focus:bg-panel focus:shadow-[0_0_0_3px_rgb(46_123_255_/_0.16)]"
        )}
      />
      {trailing && <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  );
}

function ReviewRow({ label, value, muted, onEdit, last }: { label: string; value: string; muted?: boolean; onEdit: () => void; last?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3.5", !last && "border-b border-line")}>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink3">{label}</div>
        <div className={cn("mt-0.5 break-words text-[14px] font-semibold", muted ? "text-ink3" : "text-ink")}>{value}</div>
      </div>
      <button type="button" onClick={onEdit}
        className="flex flex-none items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-brand-500 transition-colors hover:bg-brand-500/10">
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
    </div>
  );
}

function SuccessView({ customer, onClose, navigate }: { customer: Customer; onClose: () => void; navigate: (to: string) => void }) {
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] text-center sm:justify-start sm:pb-8 sm:pt-10">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-success to-brand-500 shadow-glow">
        <svg viewBox="0 0 52 52" className="h-8 w-8" fill="none">
          <motion.path d="M14 27 l8 8 l16 -18" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.18, duration: 0.35, ease: "easeOut" }} />
        </svg>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Customer added successfully</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-ink3">
          <span className="font-semibold text-ink2">{customer.name}</span> is in your book. What's next?
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
        className="mt-7 flex w-full max-w-sm flex-col gap-2.5">
        <NextAction icon={Eye} title="View customer" desc="Open their full profile" primary onClick={() => go(`/customers/${customer.id}`)} />
        <NextAction icon={Car} title="Add vehicle" desc="Track the cars you detail for them" onClick={() => go(`/customers/${customer.id}`)} />
        <NextAction icon={CalendarPlus} title="Schedule appointment" desc="Book their first detail" onClick={() => go("/appointments")} />
      </motion.div>

      <button onClick={onClose} className="mt-5 text-[12.5px] font-semibold text-ink3 transition-colors hover:text-ink">
        Back to customers
      </button>
    </div>
  );
}

function NextAction({ icon: Icon, title, desc, primary, onClick }: {
  icon: LucideIcon; title: string; desc: string; primary?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "group flex items-center gap-3.5 rounded-2xl px-4 py-3 text-left transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out active:scale-[0.99]",
        primary
          ? "border border-brand-600/50 bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-glow hover:-translate-y-0.5 hover:shadow-glow-lg"
          : "border border-line bg-panel2/50 text-ink hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-lift"
      )}>
      <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-xl", primary ? "bg-white/15 text-white" : "bg-brand-500/10 text-brand-500")}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold">{title}</span>
        <span className={cn("block text-[12px]", primary ? "text-white/80" : "text-ink3")}>{desc}</span>
      </span>
      <ArrowRight className={cn("h-[18px] w-[18px] flex-none transition-transform duration-150 group-hover:translate-x-0.5", primary ? "text-white/90" : "text-ink3")} />
    </button>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, User, Phone, Mail, MapPin, StickyNote, X, Loader2,
  Car, CalendarPlus, ReceiptText, ArrowRight, Lightbulb, CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CustomerInput } from "@/hooks/useCustomers";
import type { Customer } from "@/lib/models";

const EMPTY: CustomerInput = { name: "", email: "", phone: "", address: "", notes: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Progressive US phone formatting while typing: 2145550142 → (214) 555-0142. */
function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Purpose-built "Add Customer" experience — deliberately the same five fields,
 * elevated: iconized inputs, live inline validation, a success flow that hands
 * off to the next natural step, and full keyboard + a11y support. Built as its
 * own dialog (not the generic Modal) so the header, validation, footer and
 * success state can all be first-class. New optional fields drop straight into
 * the field stack without touching the layout.
 */
export function AddCustomerModal({ open, onClose, create }: {
  open: boolean;
  onClose: () => void;
  create: (input: CustomerInput) => Promise<Customer>;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<Customer | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Fresh state + focus every time it opens.
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY); setTouched({}); setSubmitAttempted(false);
    setBusy(false); setServerError(null); setCreated(null);
    const t = setTimeout(() => nameRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const set = (patch: Partial<CustomerInput>) => setForm((f) => ({ ...f, ...patch }));
  const blur = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const emailValid = !form.email || EMAIL_RE.test(form.email);
  const nameError = (submitAttempted || touched.name) && !form.name.trim() ? "Enter the customer's name" : null;
  const emailError = (submitAttempted || touched.email) && form.email && !emailValid ? "That email doesn't look right" : null;
  const emailOk = Boolean(form.email && emailValid);

  const doCreate = async () => {
    setBusy(true); setServerError(null);
    try {
      const c = await create({ ...form, name: form.name.trim() });
      setCreated(c);
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || created) return;
    setSubmitAttempted(true);
    if (!form.name.trim() || !emailValid) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      (!form.name.trim() ? nameRef : emailRef).current?.focus();
      return;
    }
    void doCreate();
  };

  // Esc to close; Tab wraps focus inside the dialog (focus trap).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !busy) { e.preventDefault(); onClose(); return; }
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

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
        className="fixed inset-0 bg-carbon-950/55 backdrop-blur-sm" onClick={() => !busy && onClose()} />

      <motion.div
        ref={panelRef}
        role="dialog" aria-modal="true"
        aria-labelledby="add-customer-title" aria-describedby="add-customer-desc"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="surface surface-raised relative z-10 flex max-h-[94dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-3xl sm:my-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 flex-none rounded-full bg-line2 sm:hidden" />

        {created ? (
          <SuccessView customer={created} onClose={onClose} navigate={navigate} />
        ) : (
          <>
            {/* Header */}
            <div className="relative flex items-start gap-4 px-6 pb-5 pt-6">
              <span className="relative flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet text-white shadow-glow">
                <span aria-hidden className="absolute inset-0 rounded-2xl bg-paint-gloss opacity-40" />
                <UserPlus className="relative h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="add-customer-title" className="font-display text-[20px] font-bold tracking-tight text-ink">Add Customer</h2>
                <p id="add-customer-desc" className="mt-1 text-[13px] leading-relaxed text-ink3">
                  Create a customer profile to start tracking vehicles, appointments, invoices, and service history.
                </p>
              </div>
              <button onClick={() => !busy && onClose()} aria-label="Close"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-line2 hover:text-ink active:scale-90">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="hairline-glow mx-6 flex-none" />

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <fieldset disabled={busy} className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-col gap-4">
                  <Field id="c-name" label="Name" icon={User} error={nameError} shake={shaking && Boolean(nameError)}>
                    <input ref={nameRef} id="c-name" value={form.name} onChange={(e) => set({ name: e.target.value })}
                      onBlur={() => blur("name")} placeholder="Jane Doe" autoComplete="off"
                      aria-required="true" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "c-name-err" : undefined}
                      className={inputCls(Boolean(nameError))} />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="c-phone" label="Phone" optional icon={Phone}>
                      <input id="c-phone" inputMode="tel" value={form.phone ?? ""}
                        onChange={(e) => set({ phone: formatPhone(e.target.value) })}
                        placeholder="(214) 555-0142" autoComplete="off" className={inputCls(false)} />
                    </Field>

                    <Field id="c-email" label="Email" optional icon={Mail} error={emailError} shake={shaking && Boolean(emailError)}
                      trailing={emailOk ? <CheckCircle2 className="h-[18px] w-[18px] text-success" aria-label="Valid email" /> : undefined}>
                      <input ref={emailRef} id="c-email" type="email" inputMode="email" value={form.email ?? ""}
                        onChange={(e) => set({ email: e.target.value })} onBlur={() => blur("email")}
                        placeholder="jane@example.com" autoComplete="off"
                        aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "c-email-err" : undefined}
                        className={inputCls(Boolean(emailError), emailOk)} />
                    </Field>
                  </div>

                  <Field id="c-address" label="Address" optional icon={MapPin}>
                    <input id="c-address" value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })}
                      placeholder="123 Main St, Plano TX" autoComplete="off" className={inputCls(false)} />
                  </Field>

                  <Field id="c-notes" label="Notes" optional icon={StickyNote} align="top">
                    <textarea id="c-notes" rows={3} value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })}
                      placeholder="Gate code, preferred times, favourite services…"
                      className={cn(inputCls(false), "h-auto min-h-[84px] resize-none py-3 leading-relaxed")} />
                  </Field>

                  {/* Next-step callout */}
                  <div className="mt-1 flex items-start gap-3 rounded-2xl bg-brand-500/[0.07] px-4 py-3.5 ring-1 ring-inset ring-brand-500/15">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-500/12 text-brand-500">
                      <Lightbulb className="h-[17px] w-[17px]" />
                    </span>
                    <div>
                      <div className="text-[12.5px] font-bold text-ink">Next step</div>
                      <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink3">
                        Once created, you can add their vehicles, schedule appointments, and send invoices.
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {serverError && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden">
                        <div className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[12.5px] font-medium text-danger ring-1 ring-inset ring-danger/20">
                          {serverError}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </fieldset>

              {/* Footer */}
              <div className="flex flex-none flex-col-reverse gap-2.5 border-t border-line px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:pb-4">
                <button type="button" onClick={onClose} disabled={busy}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-panel px-4 text-[13.5px] font-semibold text-ink2 transition-colors hover:border-ink3/60 hover:bg-panel2 active:scale-[0.98] disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={busy}
                  className="group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl border border-brand-600/60 bg-gradient-to-b from-brand-400 to-brand-600 px-5 text-[14px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-glow-lg hover:brightness-[1.05] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80">
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                  {busy ? (<><Loader2 className="relative h-4 w-4 animate-spin" /> Saving…</>)
                        : (<><UserPlus className="relative h-4 w-4" /> Save Customer</>)}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ parts */

const inputCls = (err: boolean, ok?: boolean) => cn(
  "h-12 w-full rounded-xl border bg-panel2 pl-11 text-[14px] text-ink outline-none placeholder:text-ink3/70 sm:h-11",
  "shadow-[inset_0_1px_2px_rgb(16_22_38_/_0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out",
  ok ? "pr-10" : "pr-3.5",
  err
    ? "border-danger/55 focus:border-danger focus:shadow-[0_0_0_3px_rgb(229_72_77_/_0.15)]"
    : "border-line hover:border-ink3/50 focus:border-brand-500 focus:bg-panel focus:shadow-[0_0_0_3px_rgb(46_123_255_/_0.16),0_1px_3px_rgb(46_123_255_/_0.10)]"
);

function Field({ id, label, optional, icon: Icon, error, shake, trailing, align = "center", children }: {
  id: string; label: string; optional?: boolean; icon: LucideIcon;
  error?: string | null; shake?: boolean; trailing?: ReactNode; align?: "center" | "top"; children: ReactNode;
}) {
  return (
    <motion.div animate={shake ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }} transition={{ duration: 0.45 }}>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
        {label}
        {optional
          ? <span className="font-normal text-ink3">(Optional)</span>
          : <span className="text-brand-500" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <Icon aria-hidden className={cn("pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-ink3", align === "top" ? "top-3.5" : "top-1/2 -translate-y-1/2")} />
        {children}
        {trailing && <span className="absolute right-3.5 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p id={`${id}-err`} role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 overflow-hidden text-[12px] font-medium text-danger">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SuccessView({ customer, onClose, navigate }: {
  customer: Customer; onClose: () => void; navigate: (to: string) => void;
}) {
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <div className="flex flex-col items-center px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-9 text-center sm:pb-8">
      {/* Animated success check */}
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-success to-brand-500 shadow-glow">
        <svg viewBox="0 0 52 52" className="h-8 w-8" fill="none">
          <motion.path d="M14 27 l8 8 l16 -18" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.18, duration: 0.35, ease: "easeOut" }} />
        </svg>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h2 className="mt-4 font-display text-[19px] font-bold tracking-tight text-ink">Customer created</h2>
        <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-ink3">
          <span className="font-semibold text-ink2">{customer.name}</span> is in your book. What's next?
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
        className="mt-6 flex w-full flex-col gap-2.5">
        <NextAction icon={Car} title="Add vehicle" desc="Track the cars you detail for them" primary onClick={() => go(`/customers/${customer.id}`)} />
        <NextAction icon={CalendarPlus} title="Schedule appointment" desc="Book their first detail" onClick={() => go("/appointments")} />
        <NextAction icon={ReceiptText} title="Create invoice" desc="Bill a completed job" onClick={() => go("/invoices")} />
      </motion.div>

      <button onClick={onClose} className="mt-4 text-[12.5px] font-semibold text-ink3 transition-colors hover:text-ink">
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

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2, UserPlus, Wrench, CalendarPlus, FileText,
  Check, ArrowRight, X, Rocket, PartyPopper, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

const DISMISS_KEY = "ds.onboarding.dismissed";

interface StepDef {
  key: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  to: string;
  cta: string;
  done: boolean;
}

/**
 * First-run setup guide. Each step's "done" is DERIVED from real data (the shop
 * exists, a customer/service/appointment/invoice has been created) — never a
 * stored flag — so it stays honest and self-heals. The next incomplete step is
 * spotlighted with a primary CTA; finishing all five triggers a celebration.
 *
 * Dismissible (per-device, localStorage). Owners/admins only — employees don't
 * set up the business. Render nothing once dismissed.
 */
export function OnboardingChecklist({
  hasBusiness, customers, services, appointments, invoices,
}: {
  hasBusiness: boolean;
  customers: number;
  services: number;
  appointments: number;
  invoices: number;
}) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setHidden(true);
  };

  if (hidden) return null;

  const steps: StepDef[] = [
    { key: "business", title: "Create your business", desc: "Your workspace is live and ready.", icon: Building2, to: "/settings", cta: "Business settings", done: hasBusiness },
    { key: "customer", title: "Add your first customer", desc: "Start building your client book.", icon: UserPlus, to: "/customers", cta: "Add customer", done: customers > 0 },
    { key: "services", title: "Create your services", desc: "List what you offer, with pricing.", icon: Wrench, to: "/services", cta: "Add services", done: services > 0 },
    { key: "appointment", title: "Schedule an appointment", desc: "Book a customer in for a detail.", icon: CalendarPlus, to: "/appointments", cta: "Book a job", done: appointments > 0 },
    { key: "invoice", title: "Send an invoice", desc: "Bill a job and get paid.", icon: FileText, to: "/invoices", cta: "Create invoice", done: invoices > 0 },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="surface relative mt-6 overflow-hidden rounded-[22px]"
    >
      {/* brand wash + gloss */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/[0.10] via-transparent to-violet/[0.08]" />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/12 blur-[90px]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-paint-gloss opacity-30" />
      {allDone && <Confetti />}

      <div className="relative p-5 sm:p-6">
        <button
          onClick={dismiss}
          aria-label="Dismiss setup guide"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-line2 hover:text-ink active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        {allDone ? (
          <Complete onDismiss={dismiss} />
        ) : (
          <>
            {/* Header + progress */}
            <div className="flex items-start gap-3.5 pr-8">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet text-white shadow-glow">
                <Rocket className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[17px] font-bold tracking-tight text-ink">Get your shop set up</h2>
                <p className="mt-0.5 text-[13px] text-ink3">A few quick steps to a fully running detailing business.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line2">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="flex-none text-[12.5px] font-bold tnum text-ink">{doneCount}/{total}</span>
            </div>

            {/* Steps */}
            <div className="mt-4 flex flex-col gap-2">
              {steps.map((s, i) => (
                <StepRow key={s.key} step={s} current={i === currentIndex} />
              ))}
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}

function StepRow({ step, current }: { step: StepDef; current: boolean }) {
  const { title, desc, icon: Icon, to, cta, done } = step;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset transition-colors",
        current
          ? "bg-brand-500/[0.06] ring-brand-500/25"
          : done
            ? "bg-transparent ring-transparent"
            : "bg-panel2/40 ring-line/60"
      )}
    >
      {/* status marker */}
      <span
        className={cn(
          "flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors",
          done ? "bg-success text-white" : current ? "bg-brand-500/12 text-brand-500 ring-1 ring-inset ring-brand-500/30" : "bg-line2 text-ink3"
        )}
      >
        {done ? (
          <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
            <Check className="h-4 w-4" strokeWidth={3} />
          </motion.span>
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[13.5px] font-semibold", done ? "text-ink3 line-through decoration-ink3/40" : "text-ink")}>
          {title}
        </div>
        {!done && <div className="truncate text-[12px] text-ink3">{desc}</div>}
      </div>

      {done ? (
        <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.06em] text-success">Done</span>
      ) : current ? (
        <Link
          to={to}
          className="inline-flex min-h-[38px] flex-none items-center gap-1.5 rounded-lg bg-gradient-to-b from-brand-400 to-brand-600 px-3.5 text-[12.5px] font-semibold text-white shadow-glow transition-[transform,filter] duration-150 hover:brightness-[1.06] active:scale-[0.97]"
        >
          {cta}<ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <Link
          to={to}
          aria-label={cta}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-line2 hover:text-ink"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Complete({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative flex flex-col items-center gap-3 py-4 text-center">
      <motion.span
        initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet text-white shadow-glow"
      >
        <PartyPopper className="h-7 w-7" />
      </motion.span>
      <div>
        <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">You're all set! 🎉</h2>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-ink3">
          Your shop is fully set up and ready to roll. Every core tool is in place — now go make some cars shine.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="mt-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-gradient-to-b from-brand-400 to-brand-600 px-4 text-[13px] font-semibold text-white shadow-glow transition-[transform,filter] duration-150 hover:brightness-[1.06] active:scale-[0.97]"
      >
        Let's go
      </button>
    </div>
  );
}

/** A one-shot confetti burst from the top — celebration for full completion. */
function Confetti() {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return null;
  const colors = ["#2E7BFF", "#7A5BE0", "#17A867", "#E08A00", "#E5484D"];
  const pieces = Array.from({ length: 20 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const x = (Math.random() * 2 - 1) * 240;
        const rot = (Math.random() * 2 - 1) * 320;
        const delay = Math.random() * 0.15;
        const dur = 1.1 + Math.random() * 0.6;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 1, x: 0, y: -10, rotate: 0 }}
            animate={{ opacity: 0, x, y: 180 + Math.random() * 80, rotate: rot }}
            transition={{ duration: dur, ease: "easeOut", delay }}
            className="absolute left-1/2 top-3 h-2 w-2 rounded-[2px]"
            style={{ background: colors[i % colors.length] }}
          />
        );
      })}
    </div>
  );
}

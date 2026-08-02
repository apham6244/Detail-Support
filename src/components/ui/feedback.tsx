import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * App-wide feedback: toasts + a promise-based confirm dialog. Both are tiny
 * external stores exposed as plain functions, so any event handler can call
 * `toast.success(...)` or `await confirm(...)` without wiring a hook or context.
 * Mount <Toaster/> and <ConfirmHost/> once at the app shell.
 */

/* ------------------------------------------------------------------ toasts */

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
}

let toasts: ToastItem[] = [];
const tSubs = new Set<() => void>();
const tEmit = () => tSubs.forEach((f) => f());
let tid = 0;

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  tEmit();
}

function push(kind: ToastKind, message: ReactNode, action?: ToastItem["action"]): number {
  const id = ++tid;
  toasts = [...toasts, { id, kind, message, action }];
  tEmit();
  window.setTimeout(() => dismiss(id), action ? 6500 : 4000);
  return id;
}

export const toast = {
  success: (message: ReactNode, action?: ToastItem["action"]) => push("success", message, action),
  error: (message: ReactNode, action?: ToastItem["action"]) => push("error", message, action),
  info: (message: ReactNode, action?: ToastItem["action"]) => push("info", message, action),
  dismiss,
};

const TOAST_META: Record<ToastKind, { icon: typeof CheckCircle2; cls: string }> = {
  success: { icon: CheckCircle2, cls: "text-success" },
  error: { icon: AlertCircle, cls: "text-danger" },
  info: { icon: Info, cls: "text-brand-500" },
};

export function Toaster() {
  const items = useSyncExternalStore(
    (cb) => { tSubs.add(cb); return () => tSubs.delete(cb); },
    () => toasts,
    () => toasts,
  );
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:items-end">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const m = TOAST_META[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              className="surface surface-raised pointer-events-auto flex w-full max-w-[400px] items-start gap-3 rounded-xl px-3.5 py-3 sm:w-[360px]"
            >
              <m.icon className={cn("mt-0.5 h-[18px] w-[18px] flex-none", m.cls)} />
              <div className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink">{t.message}</div>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                  className="flex-none rounded-md px-2 py-0.5 text-[12.5px] font-bold text-brand-500 transition-colors hover:bg-brand-500/10"
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss"
                className="flex-none rounded-md p-0.5 text-ink3 transition-colors hover:bg-line2 hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/* ----------------------------------------------------------------- confirm */

interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "brand";
}
type ConfirmState = (ConfirmOpts & { id: number }) | null;

let current: ConfirmState = null;
let resolver: ((v: boolean) => void) | null = null;
let cid = 0;
const cSubs = new Set<() => void>();
const cEmit = () => cSubs.forEach((f) => f());

/** Styled replacement for window.confirm — resolves true/false. */
export function confirm(opts: ConfirmOpts): Promise<boolean> {
  // If one is already open, resolve it false first.
  resolver?.(false);
  current = { ...opts, id: ++cid };
  cEmit();
  return new Promise<boolean>((res) => { resolver = res; });
}

function settle(v: boolean) {
  const r = resolver;
  resolver = null;
  current = null;
  cEmit();
  r?.(v);
}

export function ConfirmHost() {
  const state = useSyncExternalStore(
    (cb) => { cSubs.add(cb); return () => cSubs.delete(cb); },
    () => current,
    () => current,
  );
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {state && (
        <div
          key={state.id}
          className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog" aria-modal="true" aria-labelledby="confirm-title"
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); settle(false); } }}
        >
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-carbon-950/55 backdrop-blur-sm" onClick={() => settle(false)} />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="surface surface-raised relative z-10 flex w-full max-w-[420px] flex-col rounded-t-2xl px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 sm:rounded-2xl sm:pb-6"
          >
            <div className="flex items-start gap-3.5">
              <span className={cn("flex h-11 w-11 flex-none items-center justify-center rounded-2xl",
                state.tone === "danger" ? "bg-danger/12 text-danger" : "bg-brand-500/12 text-brand-500")}>
                <AlertTriangle className="h-[22px] w-[22px]" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="confirm-title" className="font-display text-[17px] font-bold tracking-tight text-ink">{state.title}</h2>
                {state.body && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink3">{state.body}</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
              <button onClick={() => settle(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-panel px-4 text-[13.5px] font-semibold text-ink2 transition-colors hover:border-ink3/60 hover:bg-panel2 active:scale-[0.98]">
                {state.cancelLabel ?? "Cancel"}
              </button>
              <button autoFocus onClick={() => settle(true)}
                className={cn(
                  "inline-flex h-11 items-center justify-center rounded-xl px-5 text-[14px] font-semibold text-white shadow-sm transition-[transform,filter] duration-150 hover:brightness-[1.06] active:scale-[0.98]",
                  state.tone === "danger" ? "bg-danger" : "bg-gradient-to-b from-brand-400 to-brand-600 shadow-glow",
                )}>
                {state.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

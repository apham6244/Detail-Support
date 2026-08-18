import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional small line under the title. */
  subtitle?: string;
  /** Optional icon shown in a tinted tile beside the title. */
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Desktop max-width. "md" (default) = max-w-lg; "lg" = max-w-xl; "xl" = max-w-2xl. */
  size?: "md" | "lg" | "xl";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Keep the latest onClose without re-running the open effect (callers usually
  // pass a fresh arrow each render), so focus capture/restore stays stable.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Dialog a11y: Escape to close, focus trap, autofocus in, restore focus out.
  // Listens in the BUBBLE phase so inner widgets (e.g. Combobox) that consume
  // Escape/Tab first (via stopPropagation) close themselves without closing us.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = () =>
      panel
        ? [...panel.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
          )].filter((el) => el.getClientRects().length > 0)
        : [];
    // Move focus into the dialog (first field, else the panel itself).
    (focusable()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const f = focusable();
        if (f.length === 0) {
          e.preventDefault();
          panel?.focus();
          return;
        }
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const outside = !panel?.contains(active);
        // Wrap at the ends, and also reclaim focus if it has fallen outside the
        // panel (e.g. onto <body> after a wizard step re-render) so Tab can never
        // walk out of the dialog into the page behind it.
        if (e.shiftKey && (active === first || outside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || outside)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Only mount while open. We deliberately skip AnimatePresence's deferred exit:
  // combined with the body portal, its delayed unmount races with React removing
  // the portal node and throws "removeChild" on close / route change. Mounting
  // only when open (enter animation via motion `initial`→`animate`) is bulletproof.
  if (!open) return null;

  // Portal to <body>: pages are wrapped in `.animate-fade-up`, whose lingering
  // `transform` (animation fill-mode: both) would otherwise make this fixed
  // overlay position relative to the page box instead of the viewport — which
  // pins it to the top and clips it. The portal escapes that containing block.
  return createPortal(
    // On phones the dialog is a bottom sheet (docked to the thumb zone); on
    // sm+ it's the centered card. Same component, responsive shell.
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={
          "surface surface-raised relative z-10 flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl sm:my-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl " +
          (size === "xl" ? "sm:max-w-2xl" : size === "lg" ? "sm:max-w-xl" : "sm:max-w-lg")
        }
      >
        {/* Grabber — signals the sheet, phones only. */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 flex-none rounded-full bg-line2 sm:hidden" />
        <div className="flex flex-none items-start gap-3 border-b border-line px-5 py-4">
          {icon && (
            <span aria-hidden className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-[15px] font-semibold leading-tight">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-ink3">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 flex h-10 w-10 flex-none items-center justify-center rounded-lg text-ink3 transition-[transform,background-color,color] duration-150 ease-out hover:bg-line2 hover:text-ink active:scale-90 md:h-8 md:w-8"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-none flex-col gap-2 border-t border-line px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] [&>*]:w-full sm:flex-row sm:justify-end sm:pb-3.5 sm:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">
        {label}
        {required && <span className="text-danger" aria-hidden>*</span>}
        {hint && <span className="ml-auto font-medium normal-case tracking-normal text-ink3">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

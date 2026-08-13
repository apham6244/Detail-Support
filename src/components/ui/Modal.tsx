import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Desktop max-width. "md" (default) = max-w-lg; "lg" = max-w-xl for roomier forms. */
  size?: "md" | "lg";
}) {
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
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={
          "surface surface-raised relative z-10 flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl sm:my-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl " +
          (size === "lg" ? "sm:max-w-xl" : "sm:max-w-lg")
        }
      >
        {/* Grabber — signals the sheet, phones only. */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 flex-none rounded-full bg-line2 sm:hidden" />
        <div className="flex flex-none items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink3 transition-[transform,background-color,color] duration-150 ease-out hover:bg-line2 hover:text-ink active:scale-90 md:h-8 md:w-8"
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

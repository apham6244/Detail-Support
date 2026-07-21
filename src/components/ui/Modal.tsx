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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="surface surface-raised relative z-10 my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
      >
        <div className="flex flex-none items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink3 transition-[transform,background-color,color] duration-150 ease-out hover:bg-line2 hover:text-ink active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-none justify-end gap-2 border-t border-line px-5 py-3.5">
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
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2">
        {label}
      </span>
      {children}
    </label>
  );
}

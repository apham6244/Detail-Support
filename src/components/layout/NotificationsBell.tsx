import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  danger: "bg-danger/12 text-danger",
  warning: "bg-warning/12 text-warning",
  brand: "bg-brand-500/12 text-brand-500",
  violet: "bg-violet/12 text-violet",
};

/** Top-bar notifications — a real alerts panel backed by live data (no fake dot). */
export function NotificationsBell() {
  const { items, count } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? `Notifications — ${count} need attention` : "Notifications — all caught up"}
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-panel2 text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-brand-500 hover:text-brand-500 active:scale-90 md:h-[38px] md:w-[38px]"
      >
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-panel bg-danger px-1 text-[9.5px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
        <Bell className="h-[18px] w-[18px]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            role="dialog" aria-label="Notifications"
            className="surface surface-raised absolute right-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-display text-[14px] font-bold tracking-tight text-ink">Notifications</span>
              {count > 0 && <span className="text-[11.5px] font-semibold text-ink3">{count} to review</span>}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-9 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/12 text-success"><Check className="h-5 w-5" /></span>
                <div className="text-[13.5px] font-semibold text-ink">You're all caught up</div>
                <div className="text-[12px] leading-relaxed text-ink3">No overdue invoices or unconfirmed jobs right now.</div>
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto py-1">
                {items.map((it) => (
                  <Link key={it.key} to={it.to} onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-line2/60">
                    <span className={cn("mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg", TONE[it.tone])}>
                      <it.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{it.title}</span>
                      <span className="block truncate text-[11.5px] text-ink3">{it.detail}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

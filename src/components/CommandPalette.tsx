import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, CornerDownLeft, LayoutDashboard, Users, CalendarClock, CalendarDays,
  Target, Star, ClipboardList, FileText, Wrench, Megaphone, BarChart3, Gauge,
  ShoppingBag, UsersRound, CreditCard, Settings, Plus, UserPlus, Receipt,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { prefetchRoute } from "@/lib/prefetch";

interface Cmd {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  group: "Actions" | "Go to";
  hint?: string;
  keywords?: string;
}

const COMMANDS: Cmd[] = [
  // Quick actions first — the things a detailer does all day.
  { id: "new-appt", label: "New appointment", to: "/appointments", icon: Plus, group: "Actions", hint: "Book a job", keywords: "book schedule detail calendar" },
  { id: "new-customer", label: "Add customer", to: "/customers", icon: UserPlus, group: "Actions", hint: "New client", keywords: "client contact" },
  { id: "new-invoice", label: "Create invoice", to: "/invoices", icon: Receipt, group: "Actions", hint: "Bill a job", keywords: "bill payment" },
  // Navigation.
  { id: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard, group: "Go to", keywords: "home overview" },
  { id: "customers", label: "Customers", to: "/customers", icon: Users, group: "Go to", keywords: "clients" },
  { id: "appointments", label: "Appointments", to: "/appointments", icon: CalendarClock, group: "Go to", keywords: "calendar bookings jobs" },
  { id: "schedule", label: "Schedule", to: "/schedule", icon: CalendarDays, group: "Go to", keywords: "team roster" },
  { id: "leads", label: "Leads", to: "/leads", icon: Target, group: "Go to", keywords: "pipeline enquiries prospects" },
  { id: "reviews", label: "Reviews", to: "/reviews", icon: Star, group: "Go to", keywords: "google ratings reputation" },
  { id: "quotes", label: "Quotes", to: "/quotes", icon: ClipboardList, group: "Go to", keywords: "estimates" },
  { id: "invoices", label: "Invoices", to: "/invoices", icon: FileText, group: "Go to", keywords: "billing payments" },
  { id: "services", label: "Services", to: "/services", icon: Wrench, group: "Go to", keywords: "menu catalog pricing" },
  { id: "marketing", label: "Marketing", to: "/marketing", icon: Megaphone, group: "Go to", keywords: "campaigns" },
  { id: "analytics", label: "Analytics", to: "/analytics", icon: BarChart3, group: "Go to", keywords: "reports insights charts" },
  { id: "performance", label: "Performance", to: "/performance", icon: Gauge, group: "Go to", keywords: "business health milestones" },
  { id: "gear", label: "Gear Guide", to: "/gear-guide", icon: ShoppingBag, group: "Go to", keywords: "products tools recommendations" },
  { id: "team", label: "Team", to: "/team", icon: UsersRound, group: "Go to", keywords: "staff employees roles" },
  { id: "billing", label: "Billing", to: "/billing", icon: CreditCard, group: "Go to", keywords: "plan subscription payment" },
  { id: "settings", label: "Settings", to: "/settings", icon: Settings, group: "Go to", keywords: "profile preferences workspace" },
];

/**
 * ⌘K command palette — the fast path to anywhere in the app or a common action.
 * Fully keyboard-driven (↑/↓ to move, ↵ to run, Esc to close) and mouse-friendly.
 * Controlled by the app shell; the ⌘K listener lives in AppLayout so it works
 * from any page.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => (c.label + " " + (c.keywords ?? "") + " " + c.group).toLowerCase().includes(q));
  }, [query]);

  // Reset selection + query each time it opens.
  useEffect(() => {
    if (open) { setQuery(""); setActive(0); requestAnimationFrame(() => inputRef.current?.focus()); }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const run = (cmd: Cmd | undefined) => {
    if (!cmd) return;
    onClose();
    navigate(cmd.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % Math.max(1, results.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + results.length) % Math.max(1, results.length)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[active]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  let lastGroup = "";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-carbon-950/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="surface surface-raised relative z-10 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl"
        onKeyDown={onKeyDown}
      >
        {/* Search row */}
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-[18px] w-[18px] flex-none text-ink3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="h-14 w-full border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink3"
            aria-label="Search commands"
          />
          <kbd className="hidden flex-none rounded-md border border-line bg-panel2 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink3 sm:block">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="scrollbar-slim min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-[13px] text-ink3">No matches for “{query}”.</div>
          ) : (
            results.map((cmd, i) => {
              const header = cmd.group !== lastGroup ? (lastGroup = cmd.group) : null;
              const on = i === active;
              return (
                <div key={cmd.id}>
                  {header && (
                    <div className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink3">{header}</div>
                  )}
                  <button
                    data-idx={i}
                    onMouseMove={() => setActive(i)}
                    onMouseEnter={() => prefetchRoute(cmd.to)}
                    onClick={() => run(cmd)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      on ? "bg-brand-500/10" : "hover:bg-line2/60"
                    )}
                  >
                    <span className={cn("flex h-8 w-8 flex-none items-center justify-center rounded-lg", on ? "bg-brand-500/15 text-brand-500" : "bg-line2 text-ink3")}>
                      <cmd.icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className={cn("flex-1 truncate text-[13.5px] font-semibold", on ? "text-ink" : "text-ink2")}>{cmd.label}</span>
                    {cmd.hint && <span className="hidden flex-none text-[12px] text-ink3 sm:block">{cmd.hint}</span>}
                    {on && <CornerDownLeft className="h-4 w-4 flex-none text-brand-500" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

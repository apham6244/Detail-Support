import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, FileText, Target, Menu, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { prefetchRoute } from "@/lib/prefetch";
import { useEntitlements } from "@/lib/entitlements";

/**
 * Mobile bottom navigation — the primary way a detailer moves around the app
 * from their phone. Fixed to the bottom so every core destination sits in the
 * thumb zone, with a raised central "Book" action (the money move) always one
 * tap away. Desktop keeps the full sidebar; this is `md:hidden`.
 *
 * Respects the iOS home-indicator safe area, and mirrors the app's premium
 * language: a frosted surface, a sliding active pill, and the brand accent.
 */
interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function BottomNav({ onMore }: { onMore: () => void }) {
  const ent = useEntitlements();
  const { pathname } = useLocation();

  // One gated slot: show Invoices when the plan has it, else fall back to Leads
  // so a primary tab is never a dead-end upgrade wall.
  const fourth: Tab = ent.ready && ent.hasFeature("invoices")
    ? { to: "/invoices", label: "Invoices", icon: FileText }
    : { to: "/leads", label: "Leads", icon: Target };

  const left: Tab[] = [
    { to: "/", label: "Home", icon: LayoutDashboard },
    { to: "/customers", label: "Clients", icon: Users },
  ];
  const right: Tab[] = [fourth];

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Frosted bar */}
      <div className="relative border-t border-line bg-panel/85 backdrop-blur-xl">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-1">
          {left.map((t) => <TabButton key={t.to} tab={t} active={isActive(t.to)} />)}

          {/* Center: raised primary "Book" action */}
          <div className="flex items-start justify-center">
            <NavLink
              to="/appointments"
              aria-label="Book appointment"
              onTouchStart={() => prefetchRoute("/appointments")}
              onMouseEnter={() => prefetchRoute("/appointments")}
              className="group relative -mt-5 flex h-14 w-14 flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-glow ring-4 ring-panel transition-[transform,box-shadow,filter] duration-150 ease-out active:scale-95"
            >
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/25 to-transparent" />
              <Plus className="relative h-6 w-6 transition-transform duration-150 group-hover:rotate-90" strokeWidth={2.6} />
            </NavLink>
          </div>

          {right.map((t) => <TabButton key={t.to} tab={t} active={isActive(t.to)} />)}

          {/* More → opens the full drawer */}
          <button
            onClick={onMore}
            aria-label="More"
            className="group relative flex h-full min-h-[58px] flex-col items-center justify-center gap-1 py-2 text-ink3 transition-colors active:text-ink"
          >
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
            <span className="text-[10.5px] font-semibold">More</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

function TabButton({ tab, active }: { tab: Tab; active: boolean }) {
  const { to, label, icon: Icon } = tab;
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onTouchStart={() => prefetchRoute(to)}
      onMouseEnter={() => prefetchRoute(to)}
      className={cn(
        "group relative flex h-full min-h-[58px] flex-col items-center justify-center gap-1 py-2 transition-colors",
        active ? "text-brand-500" : "text-ink3 active:text-ink"
      )}
    >
      {active && (
        <motion.span
          layoutId="bottomnav-active"
          transition={{ type: "spring", stiffness: 460, damping: 40 }}
          className="absolute inset-x-3 top-1 h-1 rounded-full bg-brand-500 shadow-[0_0_10px_rgba(46,123,255,0.7)]"
        />
      )}
      <Icon className={cn("h-[22px] w-[22px] transition-transform duration-150", active ? "scale-105" : "group-active:scale-95")} strokeWidth={1.9} />
      <span className="text-[10.5px] font-semibold">{label}</span>
    </NavLink>
  );
}

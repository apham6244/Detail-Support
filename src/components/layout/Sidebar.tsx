import { NavLink } from "react-router-dom";
import { motion, LayoutGroup } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarDays,
  FileText,
  ClipboardList,
  Wrench,
  BarChart3,
  Megaphone,
  Gauge,
  ShoppingBag,
  UsersRound,
  Settings,
  Plus,
  Lock,
  Star,
  Target,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { prefetchRoute } from "@/lib/prefetch";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { DSIcon } from "@/components/brand/Logo";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  feature?: string; // gated behind this plan feature
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

// Grouped by what a detailer is actually trying to do, so the rail reads as
// four short sections instead of one long list:
//   Main     — the daily loop: check the day, find a client, look at the book
//   Business — money & the work that earns it, in funnel order
//   Growth   — the things you look at weekly, not hourly
//   Tools    — set-up and admin you touch rarely
// Every previous item is still here (nothing removed) and Billing — which had
// a live /billing route but no nav entry — is now reachable.
const navGroups: NavGroup[] = [
  {
    heading: "Main",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/appointments", label: "Appointments", icon: CalendarClock },
      { to: "/schedule", label: "Schedule", icon: CalendarDays, feature: "team_scheduling" },
    ],
  },
  {
    heading: "Business",
    items: [
      { to: "/leads", label: "Leads", icon: Target },
      { to: "/reviews", label: "Reviews", icon: Star },
      { to: "/quotes", label: "Quotes", icon: ClipboardList, feature: "quotes" },
      { to: "/invoices", label: "Invoices", icon: FileText, feature: "invoices" },
      { to: "/services", label: "Services", icon: Wrench },
    ],
  },
  {
    heading: "Growth",
    items: [
      { to: "/marketing", label: "Marketing", icon: Megaphone, feature: "marketing" },
      { to: "/analytics", label: "Analytics", icon: BarChart3, feature: "analytics" },
      { to: "/performance", label: "Performance", icon: Gauge, feature: "performance_tracking" },
    ],
  },
  {
    heading: "Tools",
    items: [
      { to: "/gear-guide", label: "Gear Guide", icon: ShoppingBag },
      { to: "/team", label: "Team", icon: UsersRound, feature: "team_members" },
      { to: "/billing", label: "Billing", icon: CreditCard },
      { to: "/settings", label: "Settings", icon: Settings },
      // Shop is TEMPORARILY HIDDEN from navigation (product-strategy decision:
      // focus the core detailing tools first). Nothing is removed — the /shop*
      // routes stay registered in App.tsx and all Shop code is intact
      // (shopCatalog.ts, ProductImage, product/brand/category/search pages, the
      // image system). To re-enable, restore the line below (and re-import the
      // `Store` icon from lucide-react above). Planned as a future marketplace.
      // { to: "/shop", label: "Shop", icon: Store },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { org, user, role } = useAuth();
  const ent = useEntitlements();
  const shopName = org?.name ?? "Detail Support";
  // The drawer instance (mobile) is the one passed an `onNavigate`; give its
  // rows more vertical room for comfortable thumb taps.
  const mobile = Boolean(onNavigate);

  return (
    <aside className="relative flex h-full w-[236px] flex-col overflow-hidden bg-sidebar text-[#C4CDE0]">
      {/* Layered background — a crafted brand surface, not a flat panel:
          a top sheen, a soft brand aura, a polished gloss, and a lit right edge. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-black/25" />
        <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-brand-500/[0.14] blur-[72px]" />
        <div className="absolute -bottom-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-violet/[0.08] blur-[80px]" />
        <div className="absolute inset-x-0 top-0 h-44 bg-paint-gloss opacity-40" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/[0.10] via-white/[0.03] to-transparent" />
      </div>

      <div className="relative z-10 flex h-full flex-col px-3 py-[18px]">
        {/* Brand — the logo gets a soft brand halo so it reads as an identity, not a favicon. */}
        <div className="flex items-center gap-3 px-2">
          <div className="relative flex-none">
            <div className="absolute -inset-1.5 rounded-[14px] bg-brand-500/30 blur-md" />
            <DSIcon size={38} className="relative" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="font-display truncate text-[14.5px] font-bold text-white">{shopName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-[#7C88A3]">
              <span className="h-1 w-1 rounded-full bg-brand-400 shadow-[0_0_6px_rgba(46,123,255,0.9)]" />
              Detail Support
            </div>
          </div>
        </div>

        <div className="mx-2 my-[14px] h-px bg-gradient-to-r from-white/[0.09] via-white/[0.05] to-transparent" />

        {/* Nav — the active pill is a single shared element that slides between rows. */}
        <LayoutGroup>
          <nav className="scrollbar-slim -mr-1 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
            {navGroups.map((group, gi) => (
              <div key={gi} className={cn(gi > 0 && "mt-4")}>
                {group.heading && (
                  <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#59647e]">
                    {group.heading}
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavRow key={item.to} item={item} ent={ent} onNavigate={onNavigate} mobile={mobile} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </LayoutGroup>

        {/* Bottom CTA + account */}
        <div className="mt-3 flex-none">
          <NavLink
            to="/appointments"
            onClick={onNavigate}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[11px] bg-gradient-to-b from-brand-400 to-brand-600 py-[11px] text-[13.5px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:shadow-glow-lg hover:brightness-[1.05] active:scale-[0.98]"
          >
            {/* subtle top-edge shine */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
            <Plus className="relative h-4 w-4 transition-transform duration-150 group-hover:rotate-90" strokeWidth={2.4} />
            <span className="relative">Book appointment</span>
          </NavLink>

          <div className="mt-3 flex items-center gap-2.5 rounded-[11px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-500/[0.18] text-[12.5px] font-bold uppercase text-brand-300 ring-1 ring-inset ring-white/10">
              {(user?.email ?? "D").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-white">
                {user?.email ?? "Not signed in"}
              </div>
              <div className="truncate text-[11px] text-[#7C88A3]">
                {role ? role[0].toUpperCase() + role.slice(1) : "Detail Support"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavRow({
  item,
  ent,
  onNavigate,
  mobile,
}: {
  item: NavItem;
  ent: ReturnType<typeof useEntitlements>;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const { to, label, icon: Icon, badge, feature } = item;
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      onTouchStart={() => prefetchRoute(to)}
      className={cn(
        "group relative flex items-center gap-[11px] rounded-[10px] px-3 text-[13.5px] font-medium outline-none transition-colors duration-150 hover:bg-white/[0.045]",
        mobile ? "py-3" : "py-[9px]"
      )}
    >
      {({ isActive }) => {
        const locked = Boolean(feature) && ent.ready && !ent.hasFeature(feature!);
        return (
          <>
            {isActive && (
              <motion.span
                layoutId="sidebar-active"
                transition={{ type: "spring", stiffness: 440, damping: 38 }}
                className="absolute inset-0 rounded-[10px] bg-gradient-to-r from-brand-500/[0.24] to-brand-500/[0.05] ring-1 ring-inset ring-brand-400/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                {/* glowing accent rail on the leading edge */}
                <span className="absolute left-[3px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand-400 shadow-[0_0_10px_rgba(46,123,255,0.85)]" />
              </motion.span>
            )}
            <Icon
              strokeWidth={1.8}
              className={cn(
                "relative z-10 h-[18px] w-[18px] flex-none transition-transform duration-150 ease-out",
                isActive
                  ? "text-brand-300"
                  : "text-[#96a2bd] group-hover:-translate-y-px group-hover:scale-[1.08] group-hover:text-white"
              )}
            />
            <span
              className={cn(
                "relative z-10 truncate transition-colors duration-150",
                isActive ? "text-white" : "text-[#AEB8CE] group-hover:text-[#EAF0FA]"
              )}
            >
              {label}
            </span>
            {locked && (
              <span className="relative z-10 ml-auto flex-none" title="Upgrade to unlock">
                <Lock className="h-[13px] w-[13px] text-[#5C6883]" />
              </span>
            )}
            {badge && !locked && (
              <span className="relative z-10 ml-auto flex h-[19px] min-w-[19px] flex-none items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10.5px] font-bold text-white shadow-[0_2px_8px_-1px_rgba(46,123,255,0.6)]">
                {badge}
              </span>
            )}
          </>
        );
      }}
    </NavLink>
  );
}

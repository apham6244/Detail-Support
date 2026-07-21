import { Link, Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users,
  Car,
  CalendarClock,
  FileText,
  UsersRound,
  TrendingUp,
  Sun,
  Moon,
  Eye,
  ArrowRight,
  Check,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { DetailImage } from "@/components/ui/DetailImage";
import { DSIcon } from "@/components/brand/Logo";
import { PHOTO, unsplash } from "@/lib/imagery";
import { cn } from "@/lib/cn";

const features = [
  { icon: Users, label: "Customers" },
  { icon: Car, label: "Vehicles" },
  { icon: CalendarClock, label: "Appointments" },
  { icon: FileText, label: "Invoices" },
  { icon: UsersRound, label: "Teams" },
  { icon: TrendingUp, label: "Growth" },
];

const trust = ["14-day free trial", "No credit card required"];

export default function Welcome() {
  const { isAuthenticated, loading } = useAuth();
  const { theme, toggle } = useTheme();

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="relative flex min-h-screen flex-col bg-carbon-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Header — spans both columns */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <DSIcon size={36} />
          <span className="font-display text-[15px] font-bold tracking-tight text-white">Detail Support</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="glass flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition hover:text-white"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <Link
            to="/login"
            className="glass hidden rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-white/[0.16] sm:inline-flex"
          >
            Log in
          </Link>
        </div>
      </header>

      {/* Text panel */}
      <div className="hero-carbon relative order-2 flex items-center px-6 pb-14 pt-10 sm:px-10 lg:order-1 lg:px-16 lg:py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/15 px-3 py-1 text-[12.5px] font-semibold text-brand-200">
            For professional auto detailers · Founding-member pricing
          </span>

          <h1 className="font-display mt-5 text-balance text-[40px] font-extrabold leading-[1.04] tracking-[-0.03em] text-white sm:text-[54px]">
            Run your detail shop,
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-r from-white via-white to-brand-200 bg-clip-text text-transparent">
              not a spreadsheet.
            </span>
          </h1>

          <p className="mt-5 max-w-[30rem] text-[15.5px] leading-relaxed text-white/70 sm:text-[16.5px]">
            No more digging through texts for a phone number, guessing who's booked tomorrow, or forgetting who still
            owes you. Every client, vehicle, appointment and invoice lives in one place — built for detailers, not
            accountants.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/signup"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-7 text-[15px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.08] hover:shadow-glow-lg active:scale-[0.98] sm:w-auto"
            >
              Start free trial
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/demo"
              className="group glass relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-7 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/20 transition-[transform,background-color,box-shadow] duration-150 hover:bg-white/[0.18] hover:ring-white/30 active:scale-[0.98] sm:w-auto"
            >
              {/* top-edge sheen — the same gloss language as the rest of the app */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent" />
              <Eye className="relative h-[18px] w-[18px]" />
              <span className="relative">Explore Demo</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-[15px] font-semibold text-white/70 transition hover:text-white sm:w-auto"
            >
              Log in
            </Link>
          </div>

          {/* Trust row */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            {trust.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-[12.5px] text-white/55">
                <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.6} />
                {t}
              </span>
            ))}
          </div>

          {/* Feature chips */}
          <div className="mt-9 flex flex-wrap gap-2.5">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-white/80 transition-colors hover:bg-white/[0.14] hover:text-white"
              >
                <Icon className="h-3.5 w-3.5 text-brand-300" />
                {label}
              </span>
            ))}
          </div>

          <p className="mt-8 border-t border-white/[0.08] pt-5 text-[12.5px] text-white/45">
            Built for mobile detailers and growing shops.
          </p>
        </motion.div>
      </div>

      {/* Image panel — a real detailer at work, with live app cards floating over it */}
      <div className="relative order-1 h-60 overflow-hidden bg-carbon-900 sm:h-80 lg:order-2 lg:h-auto lg:min-h-screen">
        <DetailImage
          src={unsplash(PHOTO.detailerGarage, { w: 1400, q: 66 })}
          alt="Professional detailer machine-polishing a vehicle in a detailing studio"
          className="absolute inset-0"
          eager
        />
        {/* Seam blend into the text panel — bottom edge on mobile, left edge on desktop. */}
        <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 to-transparent to-40% lg:hidden" />
        <div className="absolute inset-0 hidden lg:block lg:bg-gradient-to-r lg:from-carbon-950 lg:to-transparent lg:to-15%" />
        {/* Legibility only where the cards sit — the detailer stays fully lit.
            A right-edge falloff, not a blanket scrim over the whole photo. */}
        <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-gradient-to-l from-carbon-950/85 via-carbon-950/45 to-transparent lg:block" />

        <AppPreview />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating app preview — three small, real-looking slices of Detail Support.
// Desktop only (the mobile image strip is too short to hold them), and they
// hold still for anyone who prefers reduced motion.
// ---------------------------------------------------------------------------

/**
 * A single frosted "app window" holding three panels that mirror real Detail
 * Support screens — the schedule feed from the Dashboard, a Customers card, and
 * the monthly stat tiles. One frame (with a title bar) reads as a product
 * preview rather than three decorative widgets.
 *
 * Motion is entrance-only: the window lifts in, then each panel fades up in
 * sequence and everything holds still. No looping animation.
 */
function AppPreview() {
  const still = useReducedMotion();

  const panel = (delay: number) => ({
    initial: still ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    // Positioning lives on a static wrapper: framer-motion writes an inline
    // `transform` on animated elements, which would otherwise clobber the
    // `-translate-y-1/2` centering utility.
    <div
      aria-hidden
      className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 lg:block xl:right-12"
    >
    <motion.div
      initial={still ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "w-[324px] overflow-hidden rounded-2xl",
        "border border-white/[0.13] bg-carbon-950/62 backdrop-blur-2xl backdrop-saturate-150",
        "shadow-[0_1px_2px_rgba(0,0,0,0.45),0_12px_28px_-10px_rgba(0,0,0,0.7),0_44px_88px_-32px_rgba(0,0,0,0.9)]"
      )}
    >
      {/* hairline + gloss, matching the app's surfaces */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent" />

      {/* Title bar — this is what makes it read as "the app", not a widget */}
      <div className="relative flex items-center gap-2 border-b border-white/[0.08] px-3.5 py-2.5">
        <DSIcon size={17} />
        <span className="font-display text-[11.5px] font-bold tracking-tight text-white/90">Detail Support</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-white/45">
          <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_rgba(23,168,103,0.9)]" />
          Live
        </span>
      </div>

      {/* Panel 1 — Today's schedule (mirrors the Dashboard schedule feed) */}
      <motion.section {...panel(0.34)} className="relative border-b border-white/[0.07] px-3.5 py-3">
        <PanelHead icon={CalendarClock} title="Today's schedule" meta="4 jobs" />
        <div className="mt-2.5 flex flex-col gap-2">
          <Appt time="9:00" service="Full Detail" vehicle="2024 BMW M4" who="Marcus Williams" status="Confirmed" tone="success" />
          <Appt time="11:30" service="Ceramic Coating" vehicle="2023 Tesla Model S" who="Sarah Johnson" status="In progress" tone="amber" />
          <Appt time="2:00" service="Interior Detail" vehicle="2022 Porsche 911" who="John Smith" status="Scheduled" tone="brand" />
        </div>
      </motion.section>

      {/* Panel 2 — Customer overview (mirrors a Customers card) */}
      <motion.section {...panel(0.46)} className="relative border-b border-white/[0.07] px-3.5 py-3">
        <PanelHead icon={Users} title="Customer" />
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-violet to-brand-600 font-display text-[12px] font-bold text-white">
            MW
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-white">Marcus Williams</span>
              <span className="flex-none rounded-full bg-violet/20 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-violet">VIP</span>
            </div>
            <div className="truncate text-[10.5px] text-white/45">Client since Feb 2026</div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 divide-x divide-white/[0.07] rounded-xl bg-white/[0.04] py-2 ring-1 ring-inset ring-white/[0.06]">
          <MiniStat value="3" label="Vehicles" />
          <MiniStat value="8" label="Appointments" />
          <MiniStat value="$1,240" label="Total spent" />
        </div>
      </motion.section>

      {/* Panel 3 — Business overview (mirrors the Dashboard stat cards) */}
      <motion.section {...panel(0.58)} className="relative px-3.5 py-3">
        <PanelHead icon={TrendingUp} title="This month" />
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Tile icon={CircleDollarSign} tone="success" label="Revenue" value="$6,180" trend="+14%" />
          <Tile icon={CalendarClock} tone="brand" label="Appointments" value="32" />
          <Tile icon={Users} tone="violet" label="Customers" value="26" />
          <Tile icon={TrendingUp} tone="amber" label="Growth" value="+14%" />
        </div>
      </motion.section>
    </motion.div>
    </div>
  );
}

function PanelHead({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-brand-300" />
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-white/60">{title}</span>
      {meta && <span className="ml-auto text-[10.5px] text-white/40">{meta}</span>}
    </div>
  );
}

const APPT_TONE = {
  success: { dot: "bg-success", pill: "bg-success/18 text-success" },
  amber: { dot: "bg-warning", pill: "bg-warning/18 text-warning" },
  brand: { dot: "bg-brand-400", pill: "bg-brand-500/20 text-brand-200" },
} as const;

function Appt({ time, service, vehicle, who, status, tone }: {
  time: string; service: string; vehicle: string; who: string;
  status: string; tone: keyof typeof APPT_TONE;
}) {
  const t = APPT_TONE[tone];
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-2 py-1.5 ring-1 ring-inset ring-white/[0.05]">
      <span className={cn("h-1.5 w-1.5 flex-none rounded-full", t.dot)} />
      <span className="w-[38px] flex-none text-[10.5px] font-semibold tnum text-white/55">{time}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11.5px] font-semibold leading-tight text-white">{service}</div>
        <div className="truncate text-[10px] leading-tight text-white/45">{vehicle} · {who}</div>
      </div>
      <span className={cn("flex-none rounded-full px-1.5 py-[2px] text-[9px] font-bold", t.pill)}>{status}</span>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 text-center">
      <div className="font-display text-[13px] font-bold leading-none tnum text-white">{value}</div>
      <div className="mt-1 truncate text-[9px] uppercase tracking-[0.05em] text-white/40">{label}</div>
    </div>
  );
}

const TILE_TONE = {
  success: "bg-success/15 text-success",
  brand: "bg-brand-500/18 text-brand-200",
  violet: "bg-violet/18 text-violet",
  amber: "bg-warning/15 text-warning",
} as const;

function Tile({ icon: Icon, tone, label, value, trend }: {
  icon: LucideIcon; tone: keyof typeof TILE_TONE; label: string; value: string; trend?: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2.5 py-2 ring-1 ring-inset ring-white/[0.06]">
      <div className="flex items-center gap-1.5">
        <span className={cn("flex h-5 w-5 flex-none items-center justify-center rounded-md", TILE_TONE[tone])}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="truncate text-[9.5px] uppercase tracking-[0.05em] text-white/45">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-display text-[15px] font-bold leading-none tnum text-white">{value}</span>
        {trend && <span className="text-[9.5px] font-bold text-success">{trend}</span>}
      </div>
    </div>
  );
}

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
  ReceiptText,
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

        <PreviewCards />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating app preview — three small, real-looking slices of Detail Support.
// Desktop only (the mobile image strip is too short to hold them), and they
// hold still for anyone who prefers reduced motion.
// ---------------------------------------------------------------------------

function PreviewCards() {
  const still = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-8 top-1/2 hidden w-[290px] -translate-y-1/2 flex-col gap-3.5 lg:flex xl:right-12 xl:w-[310px]"
    >
      {/* One aligned column — reads as a single dashboard panel, not scattered
          bubbles. Depth comes from elevation and blur, never from position. */}
      <Card index={0} still={still}>
        <CardHead icon={CalendarClock} title="Today's schedule" meta="4 jobs" />
        <div className="mt-3 flex flex-col gap-2.5">
          <Row time="9:00" service="Full Detail" who="Marcus W." tone="success" />
          <Row time="11:30" service="Ceramic Coating" who="Priya S." tone="brand" />
          <Row time="2:00" service="Interior Detail" who="John S." tone="violet" />
        </div>
      </Card>

      <Card index={1} still={still}>
        <CardHead icon={CircleDollarSign} title="Revenue this month" />
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-[24px] font-bold leading-none tracking-tight text-white">$6,180</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-success/20 px-1.5 py-0.5 text-[10.5px] font-bold text-success">
            <TrendingUp className="h-2.5 w-2.5" />+14%
          </span>
        </div>
        {/* tiny bar chart — pure CSS, no chart lib on the landing page */}
        <div className="mt-3 flex h-9 items-end gap-1.5">
          {[38, 52, 47, 68, 80, 100].map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={cn("flex-1 rounded-sm", i === 5 ? "bg-brand-400" : "bg-white/22")}
            />
          ))}
        </div>
      </Card>

      <Card index={2} still={still}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-success/20 text-success">
            <ReceiptText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold text-white">INV-0042 paid</div>
            <div className="truncate text-[11px] text-white/55">Sarah Johnson · $265.00</div>
          </div>
          <span className="ml-auto flex-none rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
            Paid
          </span>
        </div>
      </Card>
    </div>
  );
}

/**
 * A single preview card. Motion is deliberately restrained: a crisp entrance,
 * then an almost-imperceptible 22s breathe (3px of travel + a 0.4% scale) that
 * reads as "alive" rather than "floating". Reduced-motion users get it static.
 */
function Card({ index, still, children }: {
  index: number; still: boolean | null; children: React.ReactNode;
}) {
  const breathe = still
    ? {}
    : {
        animate: { y: [0, -3, 0], scale: [1, 1.004, 1], opacity: [1, 0.97, 1] },
        transition: {
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut" as const,
          delay: index * 2.6,
        },
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.2 + index * 0.11, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        {...breathe}
        className={cn(
          "relative overflow-hidden rounded-2xl p-3.5",
          // deeper frosting so the card sits *in* the photo, not on top of it
          "border border-white/[0.13] bg-carbon-950/55 backdrop-blur-2xl backdrop-saturate-150",
          // layered elevation: tight contact shadow + wide ambient falloff
          "shadow-[0_1px_2px_rgba(0,0,0,0.45),0_10px_24px_-10px_rgba(0,0,0,0.7),0_36px_72px_-28px_rgba(0,0,0,0.85)]"
        )}
      >
        {/* hairline top highlight — the same gloss language as the app surfaces */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/[0.07] to-transparent" />
        <div className="relative">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function CardHead({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-brand-300" />
      <span className="text-[11.5px] font-semibold text-white/85">{title}</span>
      {meta && <span className="ml-auto text-[11px] text-white/45">{meta}</span>}
    </div>
  );
}

function Row({ time, service, who, tone }: {
  time: string; service: string; who: string; tone: "success" | "brand" | "violet";
}) {
  const dot = { success: "bg-success", brand: "bg-brand-400", violet: "bg-violet" }[tone];
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("h-1.5 w-1.5 flex-none rounded-full", dot)} />
      <span className="w-[42px] flex-none text-[11px] font-semibold tnum text-white/60">{time}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-white">{service}</div>
        <div className="truncate text-[10.5px] text-white/45">{who}</div>
      </div>
    </div>
  );
}

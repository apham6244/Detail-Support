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

/** Revenue curve for the dashboard chart — six months plus one either side. */
const MONTHS = [
  { m: "Jan", h: 20 }, { m: "Feb", h: 44 }, { m: "Mar", h: 50 }, { m: "Apr", h: 62 },
  { m: "May", h: 70 }, { m: "Jun", h: 100 }, { m: "Jul", h: 56 }, { m: "Aug", h: 46 },
] as const;

export default function Welcome() {
  const { isAuthenticated, loading } = useAuth();
  const { theme, toggle } = useTheme();

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    // FULL-BLEED with a soft blend, not a hard split. The photo spans the whole
    // hero; a wide left-to-right scrim darkens its left ~40% down to solid
    // carbon so the copy sits on a *darkened slice of the photo itself* rather
    // than a separate panel butted against it. That gradient IS the seam — the
    // two halves read as one surface. Mobile keeps the stacked
    // image-strip-above-copy layout, unchanged.
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-carbon-950 lg:block">
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

      {/* Content. On mobile `hero-carbon` gives it a solid panel under the
          stacked strip. On desktop it floats over the full-bleed photo (z-10)
          with a transparent background — the darkness behind the copy is the
          image's own left scrim, which is what makes the copy feel part of the
          image instead of pasted beside it. */}
      {/* The min-[1400px] step nudges the copy right for balance now that the
          cards live farther right. Crucially it widens the panel (47%→50%) in
          step with the extra left padding, so the content keeps its full 34rem
          width and never cramps — a padding-only shift would shrink the
          headline. Gated at ≥1400px because narrower screens have no room to
          move the copy without meeting the cards; 1280 and below are untouched.
          Verified the panel edge always stays left of the card cluster. */}
      <div className="hero-carbon relative order-2 flex items-center px-6 pb-14 pt-10 sm:px-10 lg:order-1 lg:z-10 lg:min-h-screen lg:w-[47%] lg:py-10 lg:pl-14 lg:pr-8 lg:[background:none] xl:pl-20 min-[1400px]:w-[50%] min-[1400px]:pl-[88px] min-[1400px]:pr-4 min-[1760px]:pl-[140px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[34rem] min-[1400px]:max-w-[39rem] min-[1536px]:max-w-[42rem]"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/15 px-3.5 py-1.5 text-[13px] font-semibold text-brand-200 min-[1400px]:gap-2 min-[1400px]:px-4 min-[1400px]:py-2 min-[1400px]:text-[13.5px]">
            For professional auto detailers · Founding-member pricing
          </span>

          {/* Explicit line breaks on desktop rather than text-balance: at the
              larger 64px size, balance kept splitting "not a spreadsheet." onto
              two lines. Fixed breaks give a deterministic three-line headline at
              every desktop width. Mobile (no br) flows naturally. */}
          <h1 className="font-display mt-7 text-[46px] font-extrabold leading-[1.02] tracking-[-0.035em] text-white sm:text-[57px] min-[1400px]:mt-8 min-[1400px]:text-[66px] min-[1536px]:text-[72px]">
            Run your{" "}
            <br className="hidden sm:block" />
            detail shop,{" "}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-white via-white to-brand-200 bg-clip-text text-transparent">
              not a spreadsheet.
            </span>
          </h1>

          <p className="mt-7 max-w-[31rem] text-[16px] leading-relaxed text-white/65 sm:text-[17.5px] min-[1400px]:max-w-[35rem] min-[1400px]:text-[18.5px]">
            No more digging through texts for a phone number, guessing who's booked tomorrow, or forgetting who still
            owes you. Every client, vehicle, appointment and invoice lives in one place — built for detailers, not
            accountants.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center min-[1400px]:mt-10">
            <Link
              to="/signup"
              className="group inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-7 text-[15px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.08] hover:shadow-glow-lg active:scale-[0.98] sm:w-auto min-[1400px]:h-[58px] min-[1400px]:gap-2.5 min-[1400px]:px-8 min-[1400px]:text-[16px]"
            >
              Start free trial
              <ArrowRight className="h-[18px] w-[18px] transition-transform duration-150 group-hover:translate-x-0.5 min-[1400px]:h-5 min-[1400px]:w-5" />
            </Link>
            <Link
              to="/demo"
              className="group glass relative inline-flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-7 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/20 transition-[transform,background-color,box-shadow] duration-150 hover:bg-white/[0.18] hover:ring-white/30 active:scale-[0.98] sm:w-auto min-[1400px]:h-[58px] min-[1400px]:gap-2.5 min-[1400px]:px-8 min-[1400px]:text-[16px]"
            >
              {/* top-edge sheen — the same gloss language as the rest of the app */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent" />
              <Eye className="relative h-5 w-5 min-[1400px]:h-[22px] min-[1400px]:w-[22px]" />
              <span className="relative">Explore Demo</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex h-[52px] w-full items-center justify-center rounded-xl px-5 text-[15px] font-semibold text-white/70 transition hover:text-white sm:w-auto min-[1400px]:h-[58px] min-[1400px]:px-6 min-[1400px]:text-[16px]"
            >
              Log in
            </Link>
          </div>

          {/* Trust row */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2.5 min-[1400px]:mt-7 min-[1400px]:gap-x-7">
            {trust.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-[13.5px] text-white/55 min-[1400px]:gap-2 min-[1400px]:text-[14.5px]">
                <Check className="h-4 w-4 text-success min-[1400px]:h-[18px] min-[1400px]:w-[18px]" strokeWidth={2.6} />
                {t}
              </span>
            ))}
          </div>

          {/* Capability strip. Deliberately quiet — hairline outlines and muted
              ink, not chunky glass pills. It reads as "here's the breadth" in
              the periphery instead of competing with the CTAs. */}
          <div className="mt-9 flex max-w-[32rem] flex-wrap gap-2.5 min-[1400px]:mt-10 min-[1400px]:max-w-[35rem]">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.02] px-3 py-[7px] text-[13px] font-medium text-white/60 transition-colors hover:border-white/20 hover:text-white/90 min-[1400px]:gap-2 min-[1400px]:px-3.5 min-[1400px]:py-2 min-[1400px]:text-[14px]"
              >
                <Icon className="h-4 w-4 text-brand-300/75 min-[1400px]:h-[18px] min-[1400px]:w-[18px]" />
                {label}
              </span>
            ))}
          </div>

          <p className="mt-9 flex items-center gap-2.5 text-[13px] text-white/40 min-[1400px]:mt-10 min-[1400px]:text-[13.5px]">
            <span className="h-px w-7 bg-white/15" />
            Built for mobile detailers and growing shops.
          </p>
        </motion.div>
      </div>

      {/* Image layer — full-bleed on desktop, a strip on top on mobile. */}
      <div className="relative order-1 h-60 overflow-hidden bg-carbon-900 sm:h-80 lg:absolute lg:inset-0 lg:z-0 lg:order-2 lg:h-full">
        <DetailImage
          // A black sports car being pressure-washed in a dark bay. Chosen by
          // LOOKING at all 16 photos in imagery.ts, not by scoring them (an
          // earlier pass picked an abstract motion blur that measured dark but
          // read as nothing). Contains no people, so no warm-skin bleed, and the
          // deep body shadows give the glass cards dark backdrops.
          // object-right so the wheel + spray anchor the visible right side and
          // the darker rear panels fall under the copy scrim on the left.
          src={unsplash(PHOTO.pressureWash, { w: 1800, q: 72 })}
          alt="Black sports car being pressure-washed in a detailing bay"
          className="absolute inset-0"
          imgClassName="object-[68%_center] lg:scale-105"
          eager
        />
        {/* Mobile: blend the strip's bottom edge into the copy below. */}
        <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 to-transparent to-40% lg:hidden" />

        {/* ── THE BLEND ──────────────────────────────────────────────────────
            One continuous scene, not a left panel + a right panel. TWO layers
            do the work:

            1. A long, many-stopped left→right fade that now carries the dark
               MUCH farther right. It stays solid under the copy (0–40%), holds
               heavy (~0.8) out to ~58%, and is still half-dark (~0.46) at 74% —
               so the frame reads as roughly 70–80% shadow, not 50%. It only
               reaches fully clear at 100%. Because the ramp spans ~60% of the
               width in nine soft stops there is no edge anywhere: the car
               dissolves into being across the whole right half rather than
               starting at a line. The whole cluster of cards sits inside the
               shadow, tying them to the same background.

            2. A soft radial pool anchored left-of-centre, reaching to ~80%.
               Its elliptical falloff keeps the shadow from reading as a vertical
               band — cinematic light dropping off into the scene, not a wall. */}
        <div className="absolute inset-0 hidden lg:block lg:bg-[linear-gradient(to_right,rgb(7_10_17)_0%,rgb(7_10_17)_40%,rgb(7_10_17/0.93)_50%,rgb(7_10_17/0.8)_58%,rgb(7_10_17/0.63)_66%,rgb(7_10_17/0.46)_74%,rgb(7_10_17/0.28)_82%,rgb(7_10_17/0.12)_91%,transparent_100%)]" />
        <div className="absolute inset-0 hidden lg:block lg:bg-[radial-gradient(145%_125%_at_14%_44%,rgb(7_10_17/0.52)_0%,rgb(7_10_17/0.26)_50%,transparent_80%)]" />
        {/* Ambient light in the copy zone — a soft brand glow top-left and a
            violet one lower down, the same palette as the app's surfaces. This
            is what keeps the dark left side feeling lit and designed rather than
            a flat black block, and ties the brand colour into the image. */}
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-24 hidden h-[560px] w-[560px] rounded-full bg-brand-500/20 blur-[130px] lg:block" />
        <div aria-hidden className="pointer-events-none absolute -left-40 bottom-[-8%] hidden h-[440px] w-[440px] rounded-full bg-violet/14 blur-[130px] lg:block" />

        {/* Top / bottom vignettes — purely so the glass cards keep dark
            backdrops; the top of the frame is a lit wall, the bottom wet floor
            with specular highlights. */}
        <div className="absolute inset-0 hidden lg:block lg:bg-gradient-to-b lg:from-carbon-950/94 lg:to-transparent lg:to-52%" />
        <div className="absolute inset-0 hidden lg:block lg:bg-gradient-to-t lg:from-carbon-950/80 lg:to-transparent lg:to-30%" />

        <AppPreview />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App preview — real-looking slices of Detail Support laid across the hero.
// Desktop only (the mobile image strip is too short to hold them), and they
// hold still for anyone who prefers reduced motion.
// ---------------------------------------------------------------------------

/**
 * The hero product showcase: one focal "app window" (title bar, revenue trend,
 * stat tiles) with four satellite screens distributed around the photo —
 * Customer and Invoice on the right rail with it, Today's schedule and Vehicle
 * history on the left. Together they cover the five screens worth showing
 * without any one card repeating another.
 *
 * Two rules keep this from degrading into scattered widgets:
 *   1. every card snaps to one of two vertical rails (never a bespoke offset);
 *   2. the focal card wins on every depth cue simultaneously — width, border
 *      brightness, shadow depth, opacity, and being the only one framed.
 *
 * Motion is entrance-only: the window lifts in, then panels and satellites fade
 * up in sequence and everything holds still. No looping animation.
 */
function AppPreview() {
  const still = useReducedMotion();

  const panel = (delay: number) => ({
    initial: still ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    // ONE INTERFACE, not five windows. The cohesion trick is shared alignment:
    // the dashboard is a large primary panel, and Schedule + Vehicle form an
    // aligned RIGHT COLUMN — same left rail, stacked and touching — so they read
    // as side panels of the same app rather than two floating screenshots. Both
    // overlap the dashboard's right edge by a sliver so the seam is closed with
    // no gap. Customer and Invoice are small accents that tuck behind the
    // dashboard's top and bottom edges, peeking out with their headers clear.
    //
    // Depth from four stacked cues — size, z-index, slight rotation, real
    // overlap. The primary is spotlit (see the glow above) so the eye lands
    // centre, then reads down the right column. Everything sits in x > ~640
    // over the car's dark rear panels; the vignettes keep the backdrops dark.
    // Positions are % of the full-bleed image, so they hold across widths.
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      {/* Spotlight. A soft brand-tinted radial glow centred on the dashboard,
          sitting under all the cards. This is the single move that turns the
          hub from "a card among cards" into the focal point — the eye locks
          onto the lit centre first, then reads outward to the satellites. */}
      <div className="absolute left-[45%] top-[24%] h-[460px] w-[560px] rounded-full bg-brand-500/12 blur-[120px]" />
      <div className="absolute left-[52%] top-[33%] h-[300px] w-[360px] rounded-full bg-brand-400/10 blur-[90px]" />

      {/* ── Customer — small accent, peeks above the dashboard's top-left ── */}
      <div className="absolute left-[51.5%] top-[12.5%] z-[22] w-[244px] rotate-[-2deg]">
        <Screen still={still} delay={0.45} tier="tertiary">
          <ScreenHead icon={Users} label="Customer" />
          <div className="mt-3 flex items-center gap-2.5">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-violet to-brand-600 font-display text-[13px] font-bold text-white">
              MW
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold leading-tight text-white">Marcus Williams</div>
              <div className="mt-0.5 truncate text-[11px] leading-tight text-white/45">Client since Feb 2026</div>
            </div>
            <span className="flex-none rounded-full bg-violet/20 px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wide text-violet">
              VIP
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.07] border-t border-white/[0.07] pt-3">
            <ScreenStat value="3" label="Vehicles" />
            <ScreenStat value="8" label="Visits" />
            <ScreenStat value="$1,240" label="Spent" />
          </div>
        </Screen>
      </div>

      {/* ── Schedule — tall, top-right; overlaps the dashboard's top-right and
          reaches highest in the cluster, which is what makes the top edge
          asymmetric rather than a level row. 300px: below ~300 the service
          names truncate to "Ceramic Co…". */}
      <div className="absolute left-[71.5%] top-[12%] z-30 w-[296px] rotate-[1.5deg]">
        <Screen still={still} delay={0.65} tier="secondary">
          <div className="flex items-center gap-2">
            <ScreenHead icon={CalendarClock} label="Today's schedule" />
            <span className="ml-auto text-[10.5px] font-medium text-white/40">4 jobs</span>
          </div>
          <div className="mt-2.5 flex flex-col">
            <Appt time="9:00 AM" service="Full Detail" vehicle="2024 BMW M4" status="Confirmed" tone="success" />
            <Appt time="11:30 AM" service="Ceramic Coating" vehicle="2023 Tesla Model S" status="In Progress" tone="amber" />
            <Appt time="2:00 PM" service="Interior Detail" vehicle="2022 Porsche 911" status="Scheduled" tone="brand" />
            <Appt time="4:30 PM" service="Maintenance Wash" vehicle="2020 Audi RS5" status="Pending" tone="muted" />
          </div>
          <CardLink label="View all appointments" center />
        </Screen>
      </div>

      {/* ── THE HUB — the focal point ───────────────────────────────────────
          Centre of the cluster, in front of everything (z-40). It wins on every
          depth cue at once: biggest, brightest border, deepest shadow, no
          rotation (the only level card, so the eye anchors here), full opacity,
          and the only card framed with a title bar. The four satellites overlap
          its corners and sit behind it.
          Positioning lives on this static wrapper because framer-motion writes
          an inline `transform`, which would clobber the utilities. */}
      <div className="absolute left-[51%] top-[27%] z-40 w-[376px]">
        <motion.div
          initial={still ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative w-full overflow-hidden rounded-2xl",
            "border border-white/[0.16] bg-carbon-950/95 backdrop-blur-md backdrop-saturate-0",
            "shadow-[0_1px_1px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.4),0_24px_48px_-16px_rgba(0,0,0,0.65),0_56px_100px_-40px_rgba(0,0,0,0.75)]"
          )}
        >
          {/* hairline + gloss, matching the app's surfaces */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent" />

          {/* Title bar — this is what makes it read as "the app", not a widget */}
          <div className="relative flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-3">
            <DSIcon size={20} />
            <span className="font-display text-[13.5px] font-bold tracking-tight text-white/90">Detail Support</span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-white/45">
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_rgba(23,168,103,0.9)]" />
              Live
            </span>
          </div>

          {/* Overview — eight labelled months so it reads as a real chart */}
          <motion.section {...panel(0.34)} className="relative px-4 pb-1 pt-3.5">
            <PanelHead icon={TrendingUp} title="Overview" meta="6 mo" />
            <div className="mt-3.5 flex h-[52px] items-end gap-2">
              {MONTHS.map(({ m, h }) => (
                <span
                  key={m}
                  style={{ height: `${h}%` }}
                  className={cn(
                    "flex-1 rounded-[3px]",
                    m === "Jun" ? "bg-gradient-to-t from-brand-600 to-brand-400" : "bg-brand-500/25"
                  )}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {MONTHS.map(({ m }) => (
                <span
                  key={m}
                  className={cn(
                    "flex-1 text-center text-[9.5px]",
                    m === "Jun" ? "font-semibold text-white/75" : "text-white/35"
                  )}
                >
                  {m}
                </span>
              ))}
            </div>
          </motion.section>

          {/* The two numbers that matter */}
          <motion.section {...panel(0.58)} className="relative grid grid-cols-2 gap-2.5 px-4 pb-4 pt-3">
            <StatTile icon={CircleDollarSign} tone="success" label="Revenue" value="$6,180" trend="+14%" note="vs last month" />
            {/* "Jobs done", not "Jobs completed": the tile is ~144px wide in
                the narrower two-column hub and the longer label truncated. */}
            <StatTile icon={CalendarClock} tone="brand" label="Jobs done" value="32" trend="+8%" note="vs last month" />
          </motion.section>
        </motion.div>
      </div>

      {/* ── Invoice — smallest, the accent; tucks under the dashboard's
          bottom-left corner. */}
      <div className="absolute left-[51.5%] top-[57.5%] z-[24] w-[180px] rotate-[-2deg]">
        <Screen still={still} delay={0.85} tier="tertiary">
          <div className="flex items-center gap-2">
            <ScreenHead icon={ReceiptText} label="Invoice" />
            <span className="ml-auto rounded-full bg-success/18 px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wide text-success">
              Paid
            </span>
          </div>
          <div className="mt-3 font-display text-[16px] font-bold tracking-tight text-white">INV-0042</div>
          <div className="mt-1 truncate text-[11px] text-white/45">Full Detail · 2024 BMW M4</div>
          <div className="mt-3 font-display text-[24px] font-bold leading-none tnum text-white">$265.00</div>
          <div className="mt-2.5 text-[11px] text-white/40">Paid on Jul 12, 2026</div>
          <CardLink label="View invoice" />
        </Screen>
      </div>

      {/* ── Vehicle — bottom-right, overlaps the dashboard's bottom-right and
          sits lower than the invoice, so the bottom edge is staggered too. */}
      <div className="absolute left-[71.5%] top-[45.5%] z-[28] w-[288px] rotate-[1.5deg]">
        <Screen still={still} delay={0.75} tier="secondary">
          <ScreenHead icon={Car} label="Vehicle" />
          <div className="mt-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold leading-tight text-white">2024 BMW M4</div>
              <div className="mt-1 truncate text-[11px] leading-tight text-white/45">Frozen Grey Metallic</div>
              <div className="mt-0.5 truncate text-[11px] leading-tight text-white/45">APX-100</div>
            </div>
            <img
              src={unsplash(PHOTO.mercWhite, { w: 320, q: 60 })}
              alt=""
              className="h-[62px] w-[112px] flex-none rounded-lg object-cover"
            />
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.07] border-t border-white/[0.07] pt-3">
            <ScreenStat value="6" label="Details" />
            <ScreenStat value="Jun 12" label="Last detail" />
            <ScreenStat value="$1,590" label="Total spent" />
          </div>
          <CardLink label="View vehicle history" />
        </Screen>
      </div>
    </div>
  );
}

/**
 * A secondary app screen. Same material as the primary window but a step
 * recessed (softer border, thinner blur, lighter shadow) so the depth order
 * reads instantly. Entrance-only motion, matching the main panel.
 */
const TIER = {
  // Secondary: close behind the hub — still crisp, only a touch dimmer.
  secondary: {
    opacity: 0.97,
    surface: "border-white/[0.12] bg-carbon-900/95 backdrop-blur-sm",
    shadow: "shadow-[0_1px_1px_rgba(0,0,0,0.45),0_2px_5px_rgba(0,0,0,0.35),0_14px_28px_-12px_rgba(0,0,0,0.5)]",
  },
  // Tertiary: furthest back — softer border, thinner blur, shallower shadow.
  // Depth here is carried by contrast, not by size alone.
  tertiary: {
    opacity: 0.9,
    surface: "border-white/[0.09] bg-carbon-900/92 backdrop-blur-[3px]",
    shadow: "shadow-[0_1px_1px_rgba(0,0,0,0.4),0_10px_20px_-10px_rgba(0,0,0,0.45)]",
  },
} as const;

function Screen({ className, delay, still, tier = "secondary", children }: {
  className?: string; delay: number; still: boolean | null;
  tier?: keyof typeof TIER; children: React.ReactNode;
}) {
  const t = TIER[tier];
  return (
    <motion.div
      initial={still ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: t.opacity, y: 0 }}
      // Slow and near-motionless: a long fade with an 8px settle, no lateral
      // drift, no scale, no loop. It should read as the page resolving rather
      // than as anything animating.
      transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-xl border px-4 py-3.5",
        // `backdrop-saturate-0` is the load-bearing class here: it drops the
        // chroma of the backdrop to zero, so no amount of skin tone behind a
        // card can tint it. Every surface in this composition uses it, which is
        // also what gives them a single consistent colour temperature.
        // NB: opacity suffixes must be steps Tailwind actually ships — `/96` is
        // not one, and it silently emits NO background-color at all (verified:
        // computed bg came back rgba(0,0,0,0)), leaving a bare blur.
        "backdrop-saturate-0",
        t.surface,
        t.shadow,
        className
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function ScreenHead({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-brand-300" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">{label}</span>
    </div>
  );
}

/** The "View all …" footer row. Signals the card is a slice of a real screen.
 *  `center` is used on the schedule card only: the hub overlaps that card's
 *  lower-LEFT corner, so a left-aligned link would be half-hidden behind it. */
function CardLink({ label, center }: { label: string; center?: boolean }) {
  return (
    <div
      className={cn(
        "mt-3 flex items-center gap-1.5 border-t border-white/[0.07] pt-3 text-[11.5px] font-medium text-brand-300",
        center && "justify-center"
      )}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </div>
  );
}

function ScreenStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-1.5 text-center">
      <div className="font-display text-[15px] font-bold leading-none tnum text-white">{value}</div>
      <div className="mt-1.5 truncate text-[9px] uppercase tracking-[0.05em] text-white/40">{label}</div>
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
  success: { dot: "bg-success", text: "text-success" },
  amber: { dot: "bg-warning", text: "text-warning" },
  brand: { dot: "bg-brand-400", text: "text-brand-200" },
  muted: { dot: "bg-white/25", text: "text-white/40" },
} as const;

/** One row of the schedule. Status is plain coloured text, not a pill — at four
 *  rows the pills stacked up into a noisy column of chips. */
function Appt({ time, service, vehicle, status, tone }: {
  time: string; service: string; vehicle: string;
  status: string; tone: keyof typeof APPT_TONE;
}) {
  const t = APPT_TONE[tone];
  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.05] py-2.5 last:border-0">
      <span className={cn("h-[7px] w-[7px] flex-none rounded-full", t.dot)} />
      <span className="w-[58px] flex-none text-[11px] font-medium tnum text-white/70">{time}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold leading-tight text-white">{service}</div>
        <div className="mt-0.5 truncate text-[10.5px] leading-tight text-white/40">{vehicle}</div>
      </div>
      <span className={cn("flex-none text-[10.5px] font-semibold", t.text)}>{status}</span>
    </div>
  );
}

const TILE_TONE = {
  success: "bg-success/15 text-success",
  brand: "bg-brand-500/18 text-brand-200",
  violet: "bg-violet/18 text-violet",
  amber: "bg-warning/15 text-warning",
} as const;

function StatTile({ icon: Icon, tone, label, value, trend, note }: {
  icon: LucideIcon; tone: keyof typeof TILE_TONE;
  label: string; value: string; trend?: string; note?: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]">
      <div className="flex items-center gap-1.5">
        <span className={cn("flex h-5 w-5 flex-none items-center justify-center rounded-md", TILE_TONE[tone])}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="truncate text-[9.5px] font-semibold uppercase tracking-[0.05em] text-white/45">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-[20px] font-bold leading-none tnum text-white">{value}</span>
        {trend && <span className="text-[11px] font-bold text-success">{trend}</span>}
      </div>
      {note && <div className="mt-1.5 text-[10px] text-white/35">{note}</div>}
    </div>
  );
}

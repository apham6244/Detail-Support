import { Link, Navigate } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Users, Car, CalendarClock, TrendingUp, Sun, Moon, Eye, ArrowRight,
  Check, CircleDollarSign, ReceiptText, Clock, History, Smartphone, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { DSIcon } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

/** Revenue bars for the dashboard preview — six months, June the peak. */
const MONTHS = [
  { m: "Jan", h: 34 }, { m: "Feb", h: 46 }, { m: "Mar", h: 52 },
  { m: "Apr", h: 64 }, { m: "May", h: 74 }, { m: "Jun", h: 100 },
] as const;

const rise = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] } },
});

export default function Welcome() {
  const { isAuthenticated, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const still = useReducedMotion();

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="relative min-h-screen bg-carbon-950 text-white">
      {/* Ambient depth — one soft brand glow behind the preview, a faint top wash.
          Deliberately restrained: premium, not a gradient soup. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute -top-40 right-[-10%] h-[620px] w-[620px] rounded-full bg-brand-500/[0.14] blur-[150px]" />
        <div className="absolute -top-24 left-[-8%] h-[420px] w-[420px] rounded-full bg-violet/[0.08] blur-[150px]" />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-carbon-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <DSIcon size={32} />
            <span className="font-display text-[15px] font-bold tracking-tight">Detail Support</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white">
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <Link to="/login" className="hidden rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-white/80 transition hover:text-white sm:inline-flex">
              Log in
            </Link>
            <Link to="/signup"
              className="rounded-lg bg-white px-3.5 py-2 text-[13.5px] font-semibold text-carbon-950 transition hover:bg-white/90 active:scale-[0.98]">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-10 lg:pb-28 lg:pt-24">
        {/* Left — copy */}
        <motion.div initial="hidden" animate="show" variants={rise()} className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-500/10 px-4 py-2 text-[13px] font-semibold text-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Built for professional auto detailers
          </span>

          <h1 className="mt-7 font-display text-[46px] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-[60px] lg:text-[68px]">
            Run your detail shop,
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-r from-white to-brand-200 bg-clip-text text-transparent">not a spreadsheet.</span>
          </h1>

          <p className="mt-7 max-w-lg text-[17px] leading-relaxed text-white/60 sm:text-[18.5px]">
            Every customer, vehicle, appointment, and invoice in one clean workspace —
            purpose-built for detailers, not accountants.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/signup"
              className="group relative inline-flex h-[56px] items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 px-8 text-[15.5px] font-semibold shadow-[0_8px_24px_-6px_rgba(46,123,255,0.55)] transition-[transform,box-shadow,filter] duration-150 hover:brightness-[1.06] hover:shadow-[0_12px_30px_-6px_rgba(46,123,255,0.65)] active:scale-[0.98]">
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
              <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[130%] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[130%]" />
              <span className="relative">Get Started Free</span>
              <ArrowRight className="relative h-[18px] w-[18px] transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
            <Link to="/demo"
              className="inline-flex h-[56px] items-center justify-center gap-2 rounded-xl px-7 text-[15.5px] font-semibold text-white ring-1 ring-inset ring-white/15 transition-[background-color,box-shadow,transform] duration-150 hover:bg-white/[0.06] hover:ring-white/25 active:scale-[0.98]">
              <Eye className="h-[18px] w-[18px]" /> Explore Demo
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5">
            {["14-day free trial", "No credit card required"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-[14px] text-white/50">
                <Check className="h-4 w-4 text-success" strokeWidth={2.6} /> {t}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Right — the product showcase */}
        <ProductShowcase still={still} />
      </section>

      {/* ── Feature highlights ─────────────────────────────────────────── */}
      <Section>
        <SectionLabel>One workspace</SectionLabel>
        <SectionTitle>Everything your shop runs on, in one place</SectionTitle>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, title: "Customers", body: "Full history, vehicles, and lifetime spend on every client." },
            { icon: CalendarClock, title: "Scheduling", body: "See the whole crew's day and book jobs without double-booking a bay." },
            { icon: ReceiptText, title: "Invoices", body: "Bill a completed job in seconds and track what's still owed." },
            { icon: TrendingUp, title: "Insights", body: "Revenue, repeat rate, and the clients worth following up." },
          ].map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      {/* ── Value props ────────────────────────────────────────────────── */}
      <Section className="border-t border-white/[0.06]">
        <SectionLabel>Why detailers switch</SectionLabel>
        <SectionTitle>Built for the way detail shops actually work</SectionTitle>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Clock, title: "Save hours every week", body: "Stop re-typing customer details across texts, notes, and spreadsheets." },
            { icon: Car, title: "Speaks your trade", body: "Services, vehicles, bays, and add-ons — the way your shop already thinks." },
            { icon: History, title: "Never lose a customer", body: "Complete history and spend on every client, kept forever." },
            { icon: Smartphone, title: "Run it from anywhere", body: "Book, invoice, and follow up from your phone between jobs." },
          ].map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      {/* ── Pricing teaser ─────────────────────────────────────────────── */}
      <Section className="border-t border-white/[0.06]">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-8 text-center sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[520px] -translate-x-1/2 rounded-full bg-brand-500/[0.12] blur-[120px]" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/25 bg-brand-500/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-200">
              <Sparkles className="h-3.5 w-3.5" /> Founding-member pricing
            </span>
            <h2 className="mx-auto mt-5 max-w-xl text-balance font-display text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">
              Try it free for 14 days. No credit card.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/55">
              Lock in early-member pricing while Detail Support is growing. Cancel anytime — your data is always yours.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup"
                className="group inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 px-7 text-[15px] font-semibold shadow-[0_8px_24px_-6px_rgba(46,123,255,0.55)] transition hover:brightness-[1.06] active:scale-[0.98]">
                Get Started Free
                <ArrowRight className="h-[18px] w-[18px] transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
              <Link to="/demo"
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/[0.06] hover:ring-white/25 active:scale-[0.98]">
                <Eye className="h-[18px] w-[18px]" /> Explore Demo
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5">
            <DSIcon size={26} />
            <span className="font-display text-[13.5px] font-bold tracking-tight text-white/80">Detail Support</span>
          </div>
          <div className="flex items-center gap-5 text-[13px] text-white/45">
            <Link to="/login" className="transition hover:text-white/80">Log in</Link>
            <Link to="/signup" className="transition hover:text-white/80">Sign up</Link>
            <Link to="/demo" className="transition hover:text-white/80">Demo</Link>
          </div>
          <p className="text-[12.5px] text-white/35">© {new Date().getFullYear()} Detail Support</p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product showcase — ONE composed mockup, not scattered screenshots.
//
// A primary dashboard window is the focal point; two smaller cards overlap its
// corners at consistent offsets, radii, and shadows (no rotation, no random
// placement). All three are positioned relative to THIS container, so the
// cluster holds together across widths. The satellites are lg-only so tablet
// and mobile never overlap.
// ---------------------------------------------------------------------------

function ProductShowcase({ still }: { still: boolean | null }) {
  const enter = (delay: number) => ({
    initial: still ? { opacity: 0 } : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:mx-0 lg:ml-auto lg:max-w-[560px]">
      {/* soft base glow so the window feels lifted off the page */}
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[36px] bg-brand-500/[0.08] blur-2xl" />

      {/* ── Primary window ─────────────────────────────────────────────── */}
      <motion.div {...enter(0.1)}
        className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-carbon-900/90 shadow-[0_2px_8px_rgba(0,0,0,0.4),0_30px_60px_-24px_rgba(0,0,0,0.7),0_60px_120px_-48px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {/* Title bar */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-3">
          <DSIcon size={20} />
          <span className="font-display text-[13px] font-bold tracking-tight text-white/90">Dashboard</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_rgba(23,168,103,0.9)]" /> Live
          </span>
        </div>

        <div className="p-4">
          {/* Revenue overview */}
          <PanelHead icon={TrendingUp} title="Revenue" meta="Last 6 months" />
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="font-display text-[26px] font-bold leading-none tnum">$6,180</div>
              <div className="mt-1.5 text-[11px] text-white/40">collected this month</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11.5px] font-bold text-success">
              <TrendingUp className="h-3 w-3" /> +14%
            </span>
          </div>
          <div className="mt-3.5 flex h-[54px] items-end gap-2">
            {MONTHS.map(({ m, h }) => (
              <span key={m} style={{ height: `${h}%` }}
                className={cn("flex-1 rounded-[3px]", m === "Jun" ? "bg-gradient-to-t from-brand-600 to-brand-400" : "bg-brand-500/25")} />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            {MONTHS.map(({ m }) => (
              <span key={m} className={cn("flex-1 text-center text-[9.5px]", m === "Jun" ? "font-semibold text-white/70" : "text-white/35")}>{m}</span>
            ))}
          </div>

          {/* Stat tiles */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <StatTile icon={CircleDollarSign} tone="success" label="Avg ticket" value="$193" note="per customer" />
            <StatTile icon={CalendarClock} tone="brand" label="Jobs done" value="32" note="this month" />
          </div>

          {/* Today's schedule */}
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <PanelHead icon={CalendarClock} title="Today's schedule" />
              <span className="ml-auto text-[10.5px] font-medium text-white/40">4 jobs</span>
            </div>
            <div className="mt-2">
              <Appt time="9:00" service="Full Detail" vehicle="2024 BMW M4" status="Confirmed" tone="success" />
              <Appt time="11:30" service="Ceramic Coating" vehicle="2023 Tesla Model S" status="In progress" tone="amber" />
              <Appt time="2:00" service="Interior Detail" vehicle="2022 Porsche 911" status="Scheduled" tone="brand" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Satellite: incoming payment (top-right corner) ─────────────── */}
      <motion.div {...enter(0.35)}
        className="absolute -right-5 -top-6 z-20 hidden w-[210px] overflow-hidden rounded-xl border border-white/[0.12] bg-carbon-800/95 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_18px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur-md lg:block">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-success/15 text-success">
            <CircleDollarSign className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[11.5px] font-semibold leading-tight">Payment received</div>
            <div className="truncate text-[10.5px] leading-tight text-white/45">Full Detail · 2024 BMW M4</div>
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="font-display text-[19px] font-bold tnum">$265.00</span>
          <span className="rounded-full bg-success/18 px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wide text-success">Paid</span>
        </div>
      </motion.div>

      {/* ── Satellite: VIP customer (bottom-left corner) ───────────────── */}
      <motion.div {...enter(0.5)}
        className="absolute -bottom-7 -left-6 z-20 hidden w-[232px] overflow-hidden rounded-xl border border-white/[0.12] bg-carbon-800/95 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_18px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur-md lg:block">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-violet to-brand-600 font-display text-[12px] font-bold text-white">MW</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight">Marcus Williams</div>
            <div className="truncate text-[10.5px] leading-tight text-white/45">8 visits · $1,240 lifetime</div>
          </div>
          <span className="flex-none rounded-full bg-violet/20 px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide text-violet">VIP</span>
        </div>
      </motion.div>
    </div>
  );
}

// --------------------------------------------------------------- primitives

function Section({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("relative", className)}>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-300/70">{children}</p>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mx-auto mt-3 max-w-2xl text-balance text-center font-display text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">{children}</h2>;
}

function FeatureCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-1 hover:border-brand-400/30 hover:bg-white/[0.04]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/12 text-brand-300 ring-1 ring-inset ring-brand-400/20 transition-transform duration-200 group-hover:scale-105">
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <h3 className="mt-4 font-display text-[16px] font-bold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">{body}</p>
    </motion.div>
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

const TILE_TONE = {
  success: "bg-success/15 text-success",
  brand: "bg-brand-500/18 text-brand-200",
} as const;

function StatTile({ icon: Icon, tone, label, value, note }: {
  icon: LucideIcon; tone: keyof typeof TILE_TONE; label: string; value: string; note?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className={cn("flex h-5 w-5 flex-none items-center justify-center rounded-md", TILE_TONE[tone])}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="truncate text-[9.5px] font-semibold uppercase tracking-[0.05em] text-white/45">{label}</span>
      </div>
      <div className="mt-2 font-display text-[19px] font-bold leading-none tnum">{value}</div>
      {note && <div className="mt-1.5 text-[10px] text-white/35">{note}</div>}
    </div>
  );
}

const APPT_TONE = {
  success: "text-success",
  amber: "text-warning",
  brand: "text-brand-200",
} as const;

function Appt({ time, service, vehicle, status, tone }: {
  time: string; service: string; vehicle: string; status: string; tone: keyof typeof APPT_TONE;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.05] py-2 last:border-0">
      <span className="w-[42px] flex-none text-[11px] font-medium tnum text-white/60">{time}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold leading-tight">{service}</div>
        <div className="truncate text-[10px] leading-tight text-white/40">{vehicle}</div>
      </div>
      <span className={cn("flex-none text-[10.5px] font-semibold", APPT_TONE[tone])}>{status}</span>
    </div>
  );
}

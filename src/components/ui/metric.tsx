import { useId } from "react";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/ui/CountUp";
import { EmptyArt } from "@/components/ui/EmptyArt";
import { TONE, type Tone, type Point } from "@/lib/metrics";
import { cn } from "@/lib/cn";

/**
 * Canonical analytics/dashboard primitives. One implementation of each, shared
 * by every metric-heavy page so nothing drifts. Visual language: `surface`
 * cards, gloss sheen, brand-lit shadows, the four `Tone` accents.
 */

/** A premium card shell: gloss sheen, generous radius, optional icon + badge. */
export function Panel({ title, subtitle, badge, icon: Icon, className, children }: {
  title: string; subtitle?: string; badge?: React.ReactNode;
  icon?: LucideIcon; className?: string; children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface relative overflow-hidden rounded-[20px]", className)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-paint-gloss opacity-30" />
      <div className="relative p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-[16.5px] font-bold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-ink3">{subtitle}</p>}
          </div>
          {badge && <div className="ml-auto flex-none pt-0.5">{badge}</div>}
        </div>
        {children}
      </div>
    </motion.section>
  );
}

/** Month-over-month trend pill. Neutral when flat. */
export function Delta({ value }: { value: number }) {
  const flat = Math.round(value) === 0;
  const up = value >= 0;
  return (
    <span className={cn(
      "inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold tnum ring-1 ring-inset",
      flat ? "bg-line2 text-ink3 ring-line" : up ? "bg-success/12 text-success ring-success/25" : "bg-danger/12 text-danger ring-danger/25"
    )}>
      {flat ? <Minus className="h-3 w-3" /> : up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {flat ? "" : up ? "+" : "−"}{Math.abs(Math.round(value))}%
    </span>
  );
}

/** The KPI card: icon bubble, animated counter, delta, comparison sub, sparkline. */
export function KpiCard({ index = 0, tone, icon: Icon, label, value, format, delta, showDelta = true, sub, series }: {
  index?: number; tone: Tone; icon: LucideIcon; label: string;
  value: number; format: (n: number) => string;
  delta: number; showDelta?: boolean; sub: string; series: Point[];
}) {
  const t = TONE[tone];
  const gid = useId().replace(/:/g, "");
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="surface group relative overflow-hidden rounded-[20px] p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-lift"
    >
      <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-60 blur-3xl transition-opacity duration-300 group-hover:opacity-90", t.glow)} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-paint-gloss opacity-40" />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", t.bubble)}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink3">{label}</span>
        </div>
        <CountUp value={value} format={format}
          className="mt-3.5 block font-display text-[30px] font-bold leading-none tracking-[-0.02em] tnum text-ink" />
        <div className="mt-2.5 flex items-center gap-2">
          {showDelta && <Delta value={delta} />}
          <span className="truncate text-[11.5px] text-ink3">{sub}</span>
        </div>
        <div className="-mx-1 mt-3 h-[46px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`sp${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.hex} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={t.hex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={t.hex} strokeWidth={2}
                fill={`url(#sp${gid})`} dot={false} animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

/** Premium chart tooltip. `format(value, name)` lets one chart mix money + counts. */
export function ChartTip({ active, payload, label, format }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface surface-raised rounded-xl px-3 py-2 shadow-lift">
      {label && <div className="text-[11.5px] font-semibold text-ink">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="mt-1 flex items-center gap-2 text-[12px] text-ink2">
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: p.color ?? p.stroke ?? p.payload?.color }} />
          <span className="text-ink3">{p.name}</span>
          <b className="ml-auto tnum text-ink">{format ? format(p.value, p.name) : p.value}</b>
        </div>
      ))}
    </div>
  );
}

/** The standard "no data yet" panel body. */
export function MiniEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center">
      <EmptyArt variant="chart" className="w-[140px]" />
      <div className="max-w-[16rem] text-[13px] text-ink3">{text}</div>
    </div>
  );
}

import { cn } from "@/lib/cn";

/**
 * Premium skeleton kit. Every loading state in the app is built from these —
 * structural placeholders that mirror the real layout so content swaps in with
 * no jump (no layout shift), a soft shimmer sweep so it reads as "loading, not
 * broken," and a gentle fade-in. Blocks use the `bg-line2` token so they're
 * theme-aware, and the shimmer highlight is a translucent white sweep that
 * works on both light and dark surfaces.
 *
 * Compose the page-shaped `PageSkeleton` for a whole route, or drop individual
 * pieces (`SkeletonTable`, `SkeletonCardGrid`, …) into a single panel.
 */

/** A single shimmering placeholder block. The atom everything else is built from. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        "relative overflow-hidden rounded-lg bg-line2",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/12 before:to-transparent",
        "dark:before:via-white/[0.07]",
        className
      )}
    />
  );
}

/** Fade wrapper — a delayed fade so instant loads never flash the skeleton. */
function Frame({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("animate-fade [animation-delay:70ms]", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ pieces */

/** Matches `PageHeader` — big title, subtitle, optional right-aligned action. */
export function SkeletonHeader({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-7 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Skeleton className="h-7 w-52 rounded-lg" />
        <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full rounded" />
      </div>
      {action && <Skeleton className="h-[38px] w-32 flex-none rounded-lg" />}
    </div>
  );
}

/** A tall hero band, for pages whose loaded state leads with a hero surface. */
export function SkeletonHero() {
  return (
    <div className="surface relative overflow-hidden rounded-[22px] p-5 sm:p-7">
      <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
      <Skeleton className="mt-3 h-3.5 w-96 max-w-full rounded" />
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="mt-2 h-5 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grid of KPI cards — icon bubble, label, big number, delta + sub, sparkline. */
export function SkeletonKpiCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface rounded-[20px] p-5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 flex-none rounded-xl" />
            <Skeleton className="h-2.5 w-20 rounded" />
          </div>
          <Skeleton className="mt-3.5 h-7 w-24 rounded-md" />
          <div className="mt-2.5 flex items-center gap-2">
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <Skeleton className="mt-3 h-[46px] w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Borderless KPI band — the app's other stat treatment (icon+label → number). */
export function SkeletonStatBand({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 border-y border-line py-6 md:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-line">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-2.5 w-16 rounded" />
          </div>
          <Skeleton className="mt-2.5 h-6 w-20 rounded-md" />
          <Skeleton className="mt-2 h-2.5 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Search field + a few filter chips. */
export function SkeletonToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Skeleton className="h-11 min-w-[220px] flex-1 rounded-xl sm:max-w-[320px]" />
      <Skeleton className="h-11 w-32 rounded-xl" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/** A faux bar chart — reads unmistakably as a chart loading. */
function ChartBars() {
  const heights = [46, 62, 40, 74, 55, 82, 60, 90, 68, 78, 52, 86];
  return (
    <div className="flex h-[200px] items-end gap-2 px-1">
      {heights.map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** A surface panel with header + chart placeholder. `wide` for the main column. */
export function SkeletonChartPanel({ className }: { className?: string }) {
  return (
    <div className={cn("surface rounded-[20px] p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <div>
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="mt-1.5 h-2.5 w-24 rounded" />
        </div>
      </div>
      <ChartBars />
    </div>
  );
}

/** A surface panel with a donut/ring placeholder (completion, share, …). */
export function SkeletonDonutPanel({ className }: { className?: string }) {
  return (
    <div className={cn("surface flex flex-col rounded-[20px] p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>
      <div className="flex flex-1 items-center justify-center py-4">
        <div className="relative h-36 w-36">
          <Skeleton className="h-36 w-36 rounded-full" />
          <div className="absolute inset-[18px] rounded-full bg-panel" />
        </div>
      </div>
    </div>
  );
}

/** A table placeholder — header row + body rows, inside a surface container. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface overflow-hidden rounded-[18px]">
      <div className="flex items-center gap-4 border-b border-line px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-2.5 rounded", i === 0 ? "w-28" : "w-16", i === cols - 1 && "ml-auto")} />
        ))}
      </div>
      <div className="divide-y divide-line2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-9 w-9 flex-none rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="mt-1.5 h-2.5 w-20 rounded" />
            </div>
            {Array.from({ length: Math.max(0, cols - 3) }).map((_, c) => (
              <Skeleton key={c} className="hidden h-3 w-16 rounded sm:block" />
            ))}
            <Skeleton className="h-5 w-16 flex-none rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A list placeholder — avatar + two lines + trailing value, in a surface. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="divide-y divide-line2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 px-4 py-4">
            <Skeleton className="h-11 w-11 flex-none rounded-xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-40 max-w-full rounded" />
              <Skeleton className="mt-2 h-2.5 w-28 rounded" />
            </div>
            <Skeleton className="hidden h-5 w-20 flex-none rounded-full sm:block" />
            <Skeleton className="h-3 w-14 flex-none rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A grid of rich content cards — avatar, name lines, stat strip, footer. */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface rounded-[18px] p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[52px] w-[52px] flex-none rounded-2xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="mt-2 h-2.5 w-36 max-w-full rounded" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-line2/40 p-3">
            {Array.from({ length: 4 }).map((_, s) => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-3.5 w-8 rounded" />
                <Skeleton className="h-2 w-10 rounded" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-4 h-2.5 w-40 max-w-full rounded" />
        </div>
      ))}
    </div>
  );
}

/** Detail page — back link, identity header, stat band, then panels. */
export function SkeletonDetail() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-28 rounded" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 flex-none rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-48 max-w-full rounded-lg" />
          <Skeleton className="mt-2.5 h-3 w-64 max-w-full rounded" />
        </div>
      </div>
      <SkeletonStatBand count={4} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <SkeletonChartPanel />
          <SkeletonList rows={4} />
        </div>
        <div className="flex flex-col gap-6">
          <div className="surface rounded-[20px] p-5">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="mt-4 h-3 w-full rounded" />
            <Skeleton className="mt-2.5 h-3 w-4/5 rounded" />
            <Skeleton className="mt-2.5 h-3 w-2/3 rounded" />
          </div>
          <div className="surface rounded-[20px] p-5">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="mt-4 h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A month-grid calendar placeholder. */
export function SkeletonCalendar() {
  return (
    <div className="surface overflow-hidden rounded-xl">
      <div className="grid grid-cols-7 border-b border-line">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-3 py-2.5">
            <Skeleton className="h-2.5 w-8 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[92px] border-b border-r border-line p-2">
            <Skeleton className="h-4 w-4 rounded" />
            {i % 3 === 0 && <Skeleton className="mt-2 h-4 w-full rounded" />}
            {i % 5 === 0 && <Skeleton className="mt-1.5 h-4 w-3/4 rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two stacked generic panels — a neutral fallback (settings, misc). */
export function SkeletonPanels({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface rounded-[20px] p-5 sm:p-6">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="mt-4 h-3 w-full rounded" />
          <Skeleton className="mt-2.5 h-3 w-11/12 rounded" />
          <Skeleton className="mt-2.5 h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- composed */

export type PageSkeletonVariant =
  | "analytics"
  | "table"
  | "cards"
  | "list"
  | "detail"
  | "calendar"
  | "hero-cards"
  | "plain";

/**
 * A whole-route skeleton, shaped to a page family so content lands with no
 * shift. `header` renders a `PageHeader`-shaped placeholder — turn it off when
 * the real `PageHeader` is already on screen above the loading gate.
 */
export function PageSkeleton({
  variant = "cards",
  header = true,
  kpis = 4,
  toolbar = true,
  className,
}: {
  variant?: PageSkeletonVariant;
  header?: boolean;
  kpis?: number;
  toolbar?: boolean;
  className?: string;
}) {
  const ownHeader = variant === "hero-cards" || variant === "detail";
  return (
    <Frame className={cn("flex flex-col gap-6", className)}>
      {header && !ownHeader && <SkeletonHeader />}

      {variant === "analytics" && (
        <>
          {kpis > 0 && <SkeletonKpiCards count={kpis} />}
          <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <SkeletonChartPanel />
            <SkeletonDonutPanel />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <SkeletonChartPanel />
            <SkeletonChartPanel />
          </div>
        </>
      )}

      {variant === "table" && (
        <>
          {kpis > 0 && <SkeletonKpiCards count={kpis} className={kpis === 5 ? "sm:grid-cols-2 xl:grid-cols-5" : undefined} />}
          {toolbar && <SkeletonToolbar />}
          <SkeletonTable rows={7} cols={kpis >= 5 ? 6 : 5} />
        </>
      )}

      {variant === "cards" && (
        <>
          {kpis > 0 && <SkeletonKpiCards count={kpis} />}
          {toolbar && <SkeletonToolbar />}
          <SkeletonCardGrid count={6} />
        </>
      )}

      {variant === "hero-cards" && (
        <>
          <SkeletonHero />
          {kpis > 0 && <SkeletonKpiCards count={kpis} />}
          {toolbar && <SkeletonToolbar />}
          <SkeletonCardGrid count={6} />
        </>
      )}

      {variant === "list" && (
        <>
          {kpis > 0 && <SkeletonStatBand count={kpis} />}
          {toolbar && <SkeletonToolbar />}
          <SkeletonList rows={7} />
        </>
      )}

      {variant === "calendar" && <SkeletonCalendar />}

      {variant === "detail" && <SkeletonDetail />}

      {variant === "plain" && <SkeletonPanels count={3} />}
    </Frame>
  );
}

/** A row of stat-card skeletons — kept for back-compat (Dashboard). */
export function SkeletonTiles({ count = 3 }: { count?: number }) {
  return <SkeletonKpiCards count={count} className={count === 3 ? "sm:grid-cols-3 lg:grid-cols-3" : undefined} />;
}

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Detail Support "DS" brand system — a custom DS monogram rendered as soft
 * machined aluminum on deep-navy automotive paint, unified by a single
 * electric-blue signature swoosh and finished with a subtle "just-detailed"
 * sparkle. Premium, software-first, timeless — not chrome, not esports.
 *
 * Palette: navy #0F172A / #111827 · brushed silver + cool gray · accent
 * electric blue #3B82F6 with a soft cyan glow.
 *
 * Pure SVG so it stays crisp from a 16px favicon to a hero. Every gradient /
 * filter id is namespaced with useId so multiple instances never collide.
 */

// Shared geometry (128×128 design space) — one source of truth so the icon
// tile, the standalone mark and the favicon can never drift.
const D_PATH = "M30 34 V94 M30 34 H46 C66 34 74 47 74 64 C74 81 66 94 46 94 H30";
const S_PATH =
  "M106 49 C101 40 90 37 85 45 C80 53 87 61 96 65 C105 69 110 78 104 86 C98 93 86 91 81 80";
const SWOOSH = "M34 100 C 56 108 84 104 106 80 C 92 92 60 96 40 90 Z";
const SWOOSH_HL = "M39 92 C 58 99 82 96 103 78";
const SPARK_OUTER = "M104 22 L106.4 29.6 L114 32 L106.4 34.4 L104 42 L101.6 34.4 L94 32 L101.6 29.6 Z";
const SPARK_INNER = "M104 24 L105.8 30.2 L112 32 L105.8 33.8 L104 40 L102.2 33.8 L96 32 L102.2 30.2 Z";

interface Ids {
  alu: string;
  glass: string;
  swoosh: string;
  shadow: string;
  glow: string;
  spark: string;
}

function metalDefs(id: Ids) {
  return (
    <>
      {/* Soft brushed aluminum — cool, machined, with one gentle reflected bounce */}
      <linearGradient id={id.alu} x1="0.15" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f2f5f9" />
        <stop offset="0.26" stopColor="#cdd5e0" />
        <stop offset="0.5" stopColor="#a3adbb" />
        <stop offset="0.66" stopColor="#828d9c" />
        <stop offset="0.8" stopColor="#b4becc" />
        <stop offset="1" stopColor="#6b7280" />
      </linearGradient>
      <linearGradient id={id.glass} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
        <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.08" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={id.swoosh} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#1e63e0" />
        <stop offset="0.55" stopColor="#3B82F6" />
        <stop offset="1" stopColor="#7dd3fc" />
      </linearGradient>
      <filter id={id.shadow} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2.6" floodColor="#050a16" floodOpacity="0.55" />
      </filter>
      <filter id={id.glow} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="2.6" />
      </filter>
      <filter id={id.spark} x="-150%" y="-150%" width="400%" height="400%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </>
  );
}

/** Swoosh + metal DS + sparkle, in shared 128-space coordinates. */
function Monogram({ id, clip }: { id: Ids; clip?: string }) {
  const swoosh = (
    <>
      <path d={SWOOSH} fill="#3B82F6" opacity="0.5" filter={`url(#${id.glow})`} />
      <path d={SWOOSH} fill={`url(#${id.swoosh})`} />
      <path d={SWOOSH_HL} fill="none" stroke="#eff6ff" strokeOpacity="0.65" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
  return (
    <>
      {clip ? <g clipPath={`url(#${clip})`}>{swoosh}</g> : swoosh}

      <g filter={`url(#${id.shadow})`} transform="translate(-4,0)">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={D_PATH} stroke="#141c2e" strokeWidth="17.5" />
          <path d={S_PATH} stroke="#141c2e" strokeWidth="16" />
          <path d={D_PATH} stroke={`url(#${id.alu})`} strokeWidth="14.5" />
          <path d={S_PATH} stroke={`url(#${id.alu})`} strokeWidth="13" />
          <path d={D_PATH} stroke={`url(#${id.glass})`} strokeWidth="14.5" />
          <path d={S_PATH} stroke={`url(#${id.glass})`} strokeWidth="13" />
        </g>
      </g>

      <path d={SPARK_OUTER} fill="#bfdbfe" opacity="0.7" filter={`url(#${id.spark})`} />
      <path d={SPARK_INNER} fill="#ffffff" />
    </>
  );
}

function useIds(): Ids {
  const raw = useId().replace(/[:]/g, "");
  return {
    alu: `${raw}-alu`,
    glass: `${raw}-glass`,
    swoosh: `${raw}-swoosh`,
    shadow: `${raw}-shadow`,
    glow: `${raw}-glow`,
    spark: `${raw}-spark`,
  };
}

/**
 * The bare DS mark (transparent background): metal monogram + blue swoosh +
 * sparkle. For the wordmark lockup and use on existing dark surfaces.
 */
export function DSMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const id = useIds();
  return (
    <svg
      viewBox="13 18 105 94"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>{metalDefs(id)}</defs>
      <Monogram id={id} />
    </svg>
  );
}

/**
 * App-icon / sidebar / favicon form: the monogram on deep-navy automotive paint
 * with a clearcoat glow, a diagonal sheen and a machined inner hairline. Matches
 * public/favicon.svg and the generated PWA icons pixel-for-pixel. Square.
 */
export function DSIcon({ size = 36, className }: { size?: number; className?: string }) {
  const id = useIds();
  const navy = `${id.alu}-navy`;
  const clearcoat = `${id.alu}-cc`;
  const sheen = `${id.alu}-sheen`;
  const clip = `${id.alu}-clip`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      className={cn("flex-none", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={navy} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12203c" />
          <stop offset="0.5" stopColor="#0f172a" />
          <stop offset="1" stopColor="#0b1120" />
        </linearGradient>
        <radialGradient id={clearcoat} cx="0.3" cy="0" r="0.95">
          <stop offset="0" stopColor="#3B82F6" stopOpacity="0.26" />
          <stop offset="0.4" stopColor="#3B82F6" stopOpacity="0.05" />
          <stop offset="0.7" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.32" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.52" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="0.58" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="0.66" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {metalDefs(id)}
        <clipPath id={clip}>
          <rect width="128" height="128" rx="28" />
        </clipPath>
      </defs>

      <rect width="128" height="128" rx="28" fill={`url(#${navy})`} />
      <g clipPath={`url(#${clip})`}>
        <rect width="128" height="128" fill={`url(#${clearcoat})`} />
        <rect width="128" height="128" fill={`url(#${sheen})`} />
      </g>
      <rect x="1.5" y="1.5" width="125" height="125" rx="26.5" fill="none" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="1" />

      <Monogram id={id} clip={clip} />
    </svg>
  );
}

/**
 * Primary wordmark lockup: DS mark + "DETAIL SUPPORT", with the accent carried
 * into "SUPPORT". variant controls the wordmark colour for dark vs light grounds.
 */
export function LogoLockup({
  variant = "dark",
  compact = false,
  className,
}: {
  variant?: "dark" | "light";
  compact?: boolean;
  className?: string;
}) {
  const main = variant === "dark" ? "text-white" : "text-ink";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <DSMark className={compact ? "h-8 w-auto" : "h-10 w-auto"} />
      <div className={cn("font-display font-extrabold leading-none tracking-tight", compact ? "text-[15px]" : "text-[18px]")}>
        <span className={main}>Detail</span>{" "}
        <span className="text-brand-500">Support</span>
      </div>
    </div>
  );
}

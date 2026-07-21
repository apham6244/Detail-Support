import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Detail Support "DS" brand mark — a bold, integrated DS monogram with a
 * chrome-metallic bevel (dark body → bright top edge), an italic forward lean,
 * a dynamic swoosh, and a small sparkle on the S. Pure SVG, so it stays crisp
 * from favicon to hero size. Gradient/filter IDs are namespaced with useId so
 * multiple instances on one page never collide.
 */
export function DSMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const raw = useId().replace(/[:]/g, "");
  const chrome = `${raw}-chrome`;
  const swoosh = `${raw}-swoosh`;
  const glow = `${raw}-glow`;
  const dPath = "M28 16 L 28 88 M 28 16 C 68 16, 84 34, 84 52 C 84 70, 68 88, 28 88";
  const sPath = "M123 29 C 110 17, 92 17, 89 32 C 86 47, 117 45, 117 62 C 116 79, 96 82, 82 69";
  return (
    <svg viewBox="10 2 132 96" className={className} style={style} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        {/* Brighter chrome: bottoms out at steel, not black, so the letter
            centres stay metallic instead of sinking into the tile. */}
        <linearGradient id={chrome} x1="0" y1="0" x2="0.12" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.18" stopColor="#dbe4f0" />
          <stop offset="0.42" stopColor="#9aa6b7" />
          <stop offset="0.6" stopColor="#6b7686" />
          <stop offset="0.82" stopColor="#4a5361" />
          <stop offset="1" stopColor="#39414e" />
        </linearGradient>
        <linearGradient id={swoosh} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8f9db1" />
          <stop offset="0.5" stopColor="#dfe7f1" />
          <stop offset="1" stopColor="#aab6c6" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d="M4 92 C 50 103, 106 84, 138 42 C 112 84, 58 100, 2 95 Z" fill={`url(#${swoosh})`} opacity="0.8" />
      {/* Layered "polished metal" DS: bright metallic rim → thin dark contrast
          border → chrome body. Makes the letters read instantly against the
          dark tile and gives a plated, raised edge. */}
      <g transform="skewX(-9)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={dPath} stroke="#dbe4f0" strokeWidth="18.5" />
        <path d={sPath} stroke="#dbe4f0" strokeWidth="18.5" />
        <path d={dPath} stroke="#0a0d13" strokeWidth="15.5" />
        <path d={sPath} stroke="#0a0d13" strokeWidth="15.5" />
        <path d={dPath} stroke={`url(#${chrome})`} strokeWidth="12.5" />
        <path d={sPath} stroke={`url(#${chrome})`} strokeWidth="12.5" />
      </g>
      <g filter={`url(#${glow})`} fill="#ffffff">
        <path d="M120 8 L 123 17 L 132 20 L 123 23 L 120 32 L 117 23 L 108 20 L 117 17 Z" />
      </g>
    </svg>
  );
}

/**
 * Icon-only lockup: the DS mark on a dark metallic rounded tile. This is the
 * sidebar / mobile / favicon form. Square by design.
 */
export function DSIcon({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex flex-none items-center justify-center overflow-hidden rounded-[9px] ring-1 ring-white/10",
        className
      )}
      style={{ width: size, height: size, background: "linear-gradient(135deg,#0b0f17,#1a2436)" }}
    >
      <span className="pointer-events-none absolute inset-0 bg-paint-gloss opacity-50" />
      <DSMark className="relative" style={{ width: Math.round(size * 0.74), height: "auto" }} />
    </span>
  );
}

/**
 * Primary / compact wordmark lockup: DS mark + "DETAIL SUPPORT".
 * variant controls the wordmark colour for dark vs light surfaces.
 * compact stacks nothing extra — it just uses a smaller mark + text.
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
  const sub = variant === "dark" ? "text-[#9fb0c8]" : "text-ink3";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <DSMark className={compact ? "h-7 w-auto" : "h-9 w-auto"} />
      <div className="leading-none">
        <div className={cn("font-display font-extrabold tracking-tight", compact ? "text-[13px]" : "text-[15px]", main)}>
          DETAIL
        </div>
        <div className={cn("font-bold tracking-[0.2em]", compact ? "text-[8.5px]" : "text-[9.5px]", sub)}>SUPPORT</div>
      </div>
    </div>
  );
}

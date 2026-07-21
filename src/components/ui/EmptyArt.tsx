import { useId } from "react";
import { cn } from "@/lib/cn";

export type EmptyArtVariant =
  | "car"
  | "garage"
  | "spray"
  | "receipt"
  | "chart"
  | "key"
  | "photo"
  | "megaphone";

/**
 * Minimal, premium automotive line-art for empty states. A shared frame (soft
 * brand glow + a floor shadow + a few foam bubbles) wraps a subject that varies
 * per page, so every empty state feels intentional and on-brand. Theme-aware:
 * neutral shapes use token classes; the brand accents are theme-independent.
 */
export function EmptyArt({
  variant = "car",
  className,
}: {
  variant?: EmptyArtVariant;
  className?: string;
}) {
  const raw = useId().replace(/[:]/g, "");
  const g = (s: string) => `${raw}-${s}`;
  return (
    <svg
      viewBox="0 0 220 150"
      className={cn("h-auto w-[210px] max-w-full", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={g("brand")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5B8EFF" />
          <stop offset="1" stopColor="#1E63E0" />
        </linearGradient>
        <linearGradient id={g("brandSoft")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2E7BFF" stopOpacity="0.5" />
          <stop offset="1" stopColor="#7A5BE0" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={g("glow")} cx="0.5" cy="0.4" r="0.5">
          <stop offset="0" stopColor="#2E7BFF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#2E7BFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft brand aura */}
      <rect width="220" height="150" fill={`url(#${g("glow")})`} />
      {/* floor shadow */}
      <ellipse cx="110" cy="126" rx="74" ry="8" className="fill-ink3/10" />

      {subjectFor(variant, g)}

      {/* foam bubbles */}
      <g>
        <Bubble cx={168} cy={34} r={8} g={g} />
        <Bubble cx={186} cy={52} r={5} g={g} />
        <Bubble cx={158} cy={54} r={3.5} g={g} />
        <Bubble cx={40} cy={44} r={6} g={g} />
        <Bubble cx={30} cy={62} r={3.5} g={g} />
      </g>
    </svg>
  );
}

function Bubble({ cx, cy, r, g }: { cx: number; cy: number; r: number; g: (s: string) => string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${g("brandSoft")})`} opacity={0.35} />
      <circle cx={cx} cy={cy} r={r} className="stroke-brand-500/30" strokeWidth={1} fill="none" />
      <circle cx={cx - r * 0.32} cy={cy - r * 0.32} r={r * 0.22} fill="#fff" opacity={0.7} />
    </g>
  );
}

function subjectFor(variant: EmptyArtVariant, g: (s: string) => string) {
  switch (variant) {
    case "garage":
      return <Garage g={g} />;
    case "spray":
      return <Spray g={g} />;
    case "receipt":
      return <Receipt g={g} />;
    case "chart":
      return <Chart g={g} />;
    case "key":
      return <KeyFob g={g} />;
    case "photo":
      return <Photo g={g} />;
    case "megaphone":
      return <Megaphone g={g} />;
    case "car":
    default:
      return <Car g={g} />;
  }
}

/* --- Subjects ------------------------------------------------------------- */

/** Sleek coupe in profile with a glass catch-light and chrome wheels. */
function Car({ g }: { g: (s: string) => string }) {
  return (
    <g>
      {/* reflection ghost */}
      <g opacity={0.12} transform="translate(0,224) scale(1,-1)">
        <path
          d="M40 92 C 42 78 58 76 70 74 L 88 58 C 98 51 120 50 138 52 C 156 54 172 60 182 70 L 190 74 C 186 84 60 84 44 84 Z"
          className="fill-ink3"
        />
      </g>
      {/* body */}
      <path
        d="M40 92 C 42 78 58 76 70 74 L 88 58 C 98 51 120 50 138 52 C 156 54 172 60 182 70 L 190 74 C 194 76 195 82 192 88 C 191 90 189 91 186 91 L 46 91 C 42 91 39 89 39 85 Z"
        className="fill-line2 stroke-ink3/35"
        strokeWidth={1.5}
      />
      {/* greenhouse / glass */}
      <path d="M92 60 L 100 54 C 108 50 122 50 128 54 L 136 62 Z" fill={`url(#${g("brand")})`} />
      <path d="M92 60 L 100 54 C 108 50 122 50 128 54 L 136 62 Z" className="stroke-brand-600/40" strokeWidth={1} />
      {/* body shine */}
      <path d="M62 72 L 150 60" className="stroke-white/50" strokeWidth={2.5} strokeLinecap="round" />
      {/* wheels */}
      <circle cx="80" cy="94" r="15" className="fill-ink" />
      <circle cx="80" cy="94" r="6.5" className="fill-panel2 stroke-ink3/30" strokeWidth={1} />
      <circle cx="160" cy="94" r="15" className="fill-ink" />
      <circle cx="160" cy="94" r="6.5" className="fill-panel2 stroke-ink3/30" strokeWidth={1} />
    </g>
  );
}

/** A garage bay, door half-rolled, brand glow spilling out. */
function Garage({ g }: { g: (s: string) => string }) {
  return (
    <g>
      <rect x="58" y="30" width="104" height="86" rx="8" className="fill-line2 stroke-ink3/30" strokeWidth={1.5} />
      <rect x="66" y="60" width="88" height="52" rx="3" fill={`url(#${g("brand")})`} opacity={0.14} />
      <rect x="66" y="60" width="88" height="52" rx="3" className="stroke-brand-500/30" strokeWidth={1} />
      {/* rolled-up door slats near the top */}
      <g className="stroke-ink3/40" strokeWidth={1.5} strokeLinecap="round">
        <line x1="66" y1="40" x2="154" y2="40" />
        <line x1="66" y1="47" x2="154" y2="47" />
        <line x1="66" y1="54" x2="154" y2="54" />
      </g>
      {/* car nose peeking out */}
      <path d="M78 112 C 79 102 88 100 96 100 L 106 92 C 114 88 128 88 136 92 L 144 100 L 144 112 Z" className="fill-panel2 stroke-ink3/35" strokeWidth={1.3} />
      <circle cx="98" cy="112" r="7" className="fill-ink" />
      <circle cx="128" cy="112" r="7" className="fill-ink" />
      <path d="M104 96 L 108 92 C 114 90 122 90 126 92 L 130 96 Z" fill={`url(#${g("brand")})`} />
    </g>
  );
}

/** A spray bottle + a folded microfiber towel with stitch texture. */
function Spray({ g }: { g: (s: string) => string }) {
  return (
    <g>
      {/* microfiber towel */}
      <rect x="112" y="82" width="72" height="34" rx="6" className="fill-line2 stroke-ink3/30" strokeWidth={1.4} />
      <g className="stroke-ink3/25" strokeWidth={1}>
        <line x1="120" y1="90" x2="176" y2="90" />
        <line x1="120" y1="98" x2="176" y2="98" />
        <line x1="120" y1="106" x2="176" y2="106" />
      </g>
      {/* spray bottle */}
      <g>
        <path d="M64 60 L 92 60 C 96 60 98 63 98 67 L 98 108 C 98 112 95 114 91 114 L 66 114 C 62 114 59 112 59 108 L 59 70 C 59 64 61 60 64 60 Z" fill={`url(#${g("brand")})`} />
        <path d="M64 60 L 92 60 C 96 60 98 63 98 67 L 98 108 C 98 112 95 114 91 114 L 66 114 C 62 114 59 112 59 108 L 59 70 C 59 64 61 60 64 60 Z" className="stroke-brand-600/40" strokeWidth={1} />
        {/* label */}
        <rect x="66" y="80" width="25" height="20" rx="3" className="fill-white/85" />
        {/* neck + trigger head */}
        <rect x="70" y="52" width="16" height="10" rx="2" className="fill-ink3/70" />
        <path d="M70 52 L 70 42 L 52 42 L 52 48 L 64 48 L 64 52 Z" className="fill-ink3/70" />
        {/* mist */}
        <g className="fill-brand-400/70">
          <circle cx="44" cy="45" r="1.6" />
          <circle cx="40" cy="40" r="1.2" />
          <circle cx="41" cy="50" r="1.2" />
          <circle cx="36" cy="45" r="1" />
        </g>
      </g>
    </g>
  );
}

/** A receipt / invoice with a torn zigzag hem and a shine. */
function Receipt({ g }: { g: (s: string) => string }) {
  return (
    <g>
      <path
        d="M78 34 L 142 34 C 145 34 147 36 147 39 L 147 108 L 140 104 L 133 108 L 126 104 L 119 108 L 112 104 L 105 108 L 98 104 L 91 108 L 84 104 L 78 108 Z"
        className="fill-line2 stroke-ink3/30"
        strokeWidth={1.4}
      />
      {/* header band */}
      <rect x="86" y="44" width="53" height="9" rx="2.5" fill={`url(#${g("brand")})`} />
      {/* lines */}
      <g className="stroke-ink3/30" strokeWidth={2} strokeLinecap="round">
        <line x1="88" y1="64" x2="137" y2="64" />
        <line x1="88" y1="73" x2="128" y2="73" />
        <line x1="88" y1="82" x2="133" y2="82" />
      </g>
      {/* total */}
      <line x1="88" y1="92" x2="137" y2="92" className="stroke-ink3/50" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

/** A minimal rising area chart. */
function Chart({ g }: { g: (s: string) => string }) {
  return (
    <g>
      <rect x="58" y="40" width="104" height="76" rx="8" className="fill-line2 stroke-ink3/25" strokeWidth={1.4} />
      {/* baseline + axis */}
      <g className="stroke-ink3/25" strokeWidth={1}>
        <line x1="72" y1="102" x2="150" y2="102" />
      </g>
      {/* area */}
      <path d="M72 96 L 92 84 L 108 90 L 126 70 L 150 62 L 150 102 L 72 102 Z" fill={`url(#${g("brand")})`} opacity={0.16} />
      <path d="M72 96 L 92 84 L 108 90 L 126 70 L 150 62" fill="none" className="stroke-brand-500" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* points */}
      <circle cx="150" cy="62" r="3.2" className="fill-brand-500" />
      <circle cx="150" cy="62" r="6" className="fill-brand-500/20" />
    </g>
  );
}

/** A car key fob — for sign-in / access-gated states. */
function KeyFob({ g }: { g: (s: string) => string }) {
  return (
    <g>
      {/* ring */}
      <circle cx="76" cy="62" r="16" className="fill-none stroke-ink3/50" strokeWidth={4} />
      {/* fob */}
      <rect x="92" y="52" width="52" height="60" rx="14" fill={`url(#${g("brand")})`} />
      <rect x="92" y="52" width="52" height="60" rx="14" className="stroke-brand-600/40" strokeWidth={1} />
      {/* buttons */}
      <circle cx="118" cy="70" r="6" className="fill-white/90" />
      <rect x="110" y="84" width="16" height="6" rx="3" className="fill-white/60" />
      <rect x="110" y="94" width="16" height="6" rx="3" className="fill-white/40" />
      {/* shine */}
      <path d="M100 60 L 112 56" className="stroke-white/50" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

/** A framed photo of a car — for job photos. */
function Photo({ g }: { g: (s: string) => string }) {
  return (
    <g>
      <rect x="62" y="40" width="96" height="76" rx="8" className="fill-panel2 stroke-ink3/30" strokeWidth={1.5} />
      <rect x="70" y="48" width="80" height="46" rx="4" fill={`url(#${g("brand")})`} opacity={0.16} />
      {/* mini car */}
      <path d="M84 84 C 85 78 92 77 98 77 L 106 70 C 112 67 124 67 130 70 L 137 77 L 137 84 Z" className="fill-panel stroke-ink3/40" strokeWidth={1.2} />
      <circle cx="100" cy="84" r="5" className="fill-ink" />
      <circle cx="124" cy="84" r="5" className="fill-ink" />
      {/* sun */}
      <circle cx="136" cy="58" r="5" className="fill-brand-400/80" />
      {/* caption line */}
      <line x1="74" y1="106" x2="120" y2="106" className="stroke-ink3/30" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

/** A megaphone with a signal arc — for marketing campaigns. */
function Megaphone({ g }: { g: (s: string) => string }) {
  return (
    <g>
      <path d="M64 78 L 92 68 L 132 52 C 136 50 140 53 140 58 L 140 98 C 140 103 136 106 132 104 L 92 88 L 64 78 Z" fill={`url(#${g("brand")})`} />
      <rect x="56" y="70" width="12" height="16" rx="3" className="fill-ink3/70" />
      <path d="M84 84 L 84 104 C 84 108 88 110 92 108 L 96 106 L 92 88 Z" className="fill-ink3/60" />
      {/* signal arcs */}
      <g className="stroke-brand-400/70" strokeWidth={2.5} fill="none" strokeLinecap="round">
        <path d="M150 66 C 158 74 158 84 150 92" />
        <path d="M158 58 C 172 72 172 86 158 100" />
      </g>
    </g>
  );
}

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Star, X, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  SUBCATEGORIES, TAG_META, badgeOf, brandOf, useCaseOf, metricsOf, productBusiness,
  EXPERIENCE_OPTIONS, BUSINESS_OPTIONS, type Product, type ProductTag,
} from "@/lib/gearCatalog";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type Tone = "amber" | "violet" | "success" | "brand";

const TONE_CHIP: Record<Tone, string> = {
  amber: "text-warning bg-warning/12 ring-warning/25",
  violet: "text-violet bg-violet/12 ring-violet/25",
  success: "text-success bg-success/12 ring-success/25",
  brand: "text-brand-500 bg-brand-500/12 ring-brand-500/25",
};

const TONE_GLOW: Record<Tone, string> = {
  amber: "bg-warning/20",
  violet: "bg-violet/20",
  success: "bg-success/20",
  brand: "bg-brand-500/20",
};

const money = (n: number) => `$${n.toLocaleString()}`;

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={`${rating.toFixed(1)} / 5 editorial score`}>
      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
      <span className="text-[12px] font-semibold tnum text-ink2">{rating.toFixed(1)}</span>
    </span>
  );
}

export function TagBadge({ tag, className }: { tag: ProductTag; className?: string }) {
  const meta = TAG_META[tag];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ring-1 ring-inset", TONE_CHIP[meta.tone], className)}>
      {meta.label}
    </span>
  );
}

export function ProductThumb({ product, className, iconClass }: { product: Product; className?: string; iconClass?: string }) {
  const Icon = SUBCATEGORIES[product.sub].icon;
  const tag = badgeOf(product);
  const tone: Tone = tag ? TAG_META[tag].tone : "brand";
  const brand = brandOf(product);
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-panel2 to-panel ring-1 ring-inset ring-line/70", className)}>
      <div className={cn("pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-2xl", TONE_GLOW[tone])} />
      {brand && (
        <span className="pointer-events-none absolute bottom-1 right-2 select-none font-display text-[11px] font-bold uppercase tracking-wide text-ink3/50">
          {brand.split(" ")[0]}
        </span>
      )}
      <Icon strokeWidth={1.5} className={cn("relative text-ink2 transition-transform duration-300 group-hover:scale-110", iconClass ?? "h-9 w-9")} />
    </div>
  );
}

export function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11.5px]">
        <span className="text-ink3">{label}</span>
        <span className="font-semibold tnum text-ink2">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line2">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product research modal (no purchase / no compare — a detail sheet)
// ---------------------------------------------------------------------------

const EXP_LABEL = Object.fromEntries(EXPERIENCE_OPTIONS.map((e) => [e.key, e.label]));
const BIZ_LABEL = Object.fromEntries(BUSINESS_OPTIONS.map((b) => [b.key, b.label]));

export function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const m = metricsOf(product);
  const brand = brandOf(product);
  const tag = badgeOf(product);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-carbon-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="surface surface-raised flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-4 border-b border-line p-5">
          <ProductThumb product={product} className="h-20 w-20 flex-none" iconClass="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {brand && <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink3">{brand}</span>}
              {tag && <TagBadge tag={tag} />}
            </div>
            <h2 className="mt-1 font-display text-[19px] font-bold leading-tight tracking-tight text-ink">{product.name}</h2>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="font-display text-[20px] font-bold tnum text-ink">{money(product.price)}</span>
              <Stars rating={product.rating} />
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink3 transition hover:bg-line2 hover:text-ink active:scale-90">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-5">
          <div className="flex items-start gap-2 rounded-xl bg-brand-500/[0.06] px-3.5 py-3 text-[13px] leading-relaxed text-ink2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-brand-500" />
            <span><span className="font-semibold text-ink">Best for:</span> {useCaseOf(product)}</span>
          </div>

          {/* Editorial comparison scores */}
          <div>
            <SectionLabel>Editorial scores</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricBar label="Quality" value={m.quality} />
              <MetricBar label="Durability" value={m.durability} />
              <MetricBar label="Ease of use" value={m.ease} />
              <MetricBar label="Pro rating" value={m.pro} />
            </div>
          </div>

          {/* Pros / cons */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <SectionLabel tone="success">Pros</SectionLabel>
              <ul className="flex flex-col gap-1.5">
                {product.pros.map((p) => (
                  <li key={p} className="flex items-start gap-1.5 text-[13px] text-ink2">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-success" />{p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionLabel tone="danger">Cons</SectionLabel>
              <ul className="flex flex-col gap-1.5">
                {product.cons.map((c) => (
                  <li key={c} className="flex items-start gap-1.5 text-[13px] text-ink2">
                    <X className="mt-0.5 h-3.5 w-3.5 flex-none text-danger" />{c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Fit chips */}
          <div className="flex flex-wrap gap-1.5">
            {product.bestFor.map((e) => <Chip key={e}>{EXP_LABEL[e]}</Chip>)}
            {productBusiness(product).map((b) => <Chip key={b} tone="violet">{BIZ_LABEL[b]}</Chip>)}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function SectionLabel({ children, tone }: { children: React.ReactNode; tone?: "success" | "danger" }) {
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink3";
  return <div className={cn("mb-2 text-[11px] font-semibold uppercase tracking-[0.07em]", c)}>{children}</div>;
}

export function Chip({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "violet" }) {
  return (
    <span className={cn(
      "rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
      tone === "violet" ? "text-violet ring-violet/25 bg-violet/5" : "text-ink2 ring-line bg-panel2/50"
    )}>
      {children}
    </span>
  );
}

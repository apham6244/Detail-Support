import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, ExternalLink, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  buyUrlFor,
  getBrand,
  getCategory,
  products,
  type ShopBrand,
  type ShopCategory,
  type ShopProduct,
} from "@/lib/shopCatalog";

/* --- Curation badges -----------------------------------------------------
   Derived from existing catalog signals (no data-structure change). One label
   per product, in priority order — so most products stay unbadged and the ones
   that are marked feel like genuine, curated recommendations. */

const NEW_IDS = new Set(
  [...products].sort((a, b) => b.added.localeCompare(a.added)).slice(0, 6).map((p) => p.id)
);

export interface CurationBadge {
  emoji: string;
  label: string;
  cls: string;
}

export function productBadge(p: ShopProduct): CurationBadge | null {
  if (NEW_IDS.has(p.id)) return { emoji: "🚀", label: "New", cls: "bg-brand-500 text-white" };
  if (p.staffPick) return { emoji: "🏆", label: "Staff Pick", cls: "bg-violet text-white" };
  if (p.bestSeller) return { emoji: "🔥", label: "Most Popular", cls: "bg-warning text-white" };
  if (p.pro && (p.featured || (p.rating >= 4.8 && p.reviews >= 500)))
    return { emoji: "💎", label: "Pro Favorite", cls: "bg-carbon-900 text-white ring-1 ring-inset ring-white/15" };
  if (p.budget === "$" && p.rating >= 4.6 && p.reviews >= 600)
    return { emoji: "⭐", label: "Best Value", cls: "bg-success text-white" };
  return null;
}

export function Badge({ badge, className }: { badge: CurationBadge; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-[3px] pl-1.5 pr-2 text-[9.5px] font-bold uppercase tracking-[0.05em] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.45)]",
        badge.cls,
        className
      )}
    >
      <span className="text-[11px] leading-none">{badge.emoji}</span>
      {badge.label}
    </span>
  );
}

/* --- Product image -------------------------------------------------------- */

/** Product imagery. Shows the real photo from `product.image` when present —
 *  contained (never stretched or cropped) on a clean stage, with lazy loading,
 *  a fade-in, and a shimmer while it loads. Falls back to a premium branded
 *  placeholder when there's no image OR the URL fails to load. */
export function ProductImage({
  product,
  className,
  iconClass = "h-16 w-16",
  showBrand = true,
}: {
  product: ShopProduct;
  className?: string;
  iconClass?: string;
  showBrand?: boolean;
}) {
  const brand = getBrand(product.brand);
  const cat = getCategory(product.category);
  const Icon = cat?.icon;

  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  // reset state if the image source changes (e.g. catalog update / list reuse)
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [product.image]);

  const useImage = Boolean(product.image) && !errored;

  return (
    <div className={cn("relative overflow-hidden rounded-xl ring-1 ring-inset ring-line/60", className)}>
      {useImage ? (
        <>
          {/* neutral stage so transparent PNGs and white-background photos both sit cleanly */}
          <div className="absolute inset-0 bg-gradient-to-br from-panel2 to-panel" />
          {!loaded && <div className="absolute inset-0 animate-pulse bg-line2/50" />}
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            className={cn(
              "relative h-full w-full object-contain p-3 transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.04]",
              loaded ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      ) : (
        <>
          {/* premium placeholder pedestal */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.10] via-panel2 to-violet/[0.07]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(46,123,255,0.14),transparent_62%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(46,123,255,0.22),transparent_58%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <div className="pointer-events-none absolute inset-0 bg-paint-gloss opacity-25" />
          {Icon && (
            <>
              <Icon className="pointer-events-none absolute -bottom-6 -right-5 h-32 w-32 text-brand-500/[0.06] transition-transform duration-700 group-hover:rotate-6" strokeWidth={1.3} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon
                  className={cn(
                    "text-brand-500/90 drop-shadow-[0_6px_16px_rgba(46,123,255,0.22)] transition-transform duration-500 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.08]",
                    iconClass
                  )}
                  strokeWidth={1.4}
                />
              </div>
            </>
          )}
          {showBrand && brand && (
            <span className="absolute left-2.5 top-2.5 rounded-md bg-panel/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink2 backdrop-blur-sm">
              {brand.name}
            </span>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/[0.06] to-transparent" />
        </>
      )}
    </div>
  );
}

/* --- Rating / price / buy ------------------------------------------------- */

const reviewLabel = (n?: number) => (n ? (n > 999 ? (n / 1000).toFixed(1) + "k" : String(n)) : "");

export function Stars({
  rating,
  reviews,
  className,
  compact,
}: {
  rating: number;
  reviews?: number;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <Star className="h-3.5 w-3.5 fill-warning text-warning" strokeWidth={0} />
        <span className="text-[12px] font-bold tnum text-ink">{rating.toFixed(1)}</span>
        {reviews ? <span className="text-[11.5px] tnum text-ink3">({reviewLabel(reviews)})</span> : null}
      </span>
    );
  }
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className={cn("h-3.5 w-3.5", i < Math.round(rating) ? "fill-warning text-warning" : "fill-none text-line2")}
            strokeWidth={i < Math.round(rating) ? 0 : 1.5}
          />
        ))}
      </div>
      <span className="text-[11.5px] tnum text-ink3">
        {rating.toFixed(1)}
        {reviews ? ` · ${reviewLabel(reviews)}` : ""}
      </span>
    </div>
  );
}

export function Price({ value, className }: { value?: number; className?: string }) {
  if (value == null) return <span className={cn("text-[12.5px] font-semibold text-ink3", className)}>See price →</span>;
  return (
    <span className={cn("font-display font-extrabold tnum leading-none text-ink", className)}>
      <span className="mr-[1px] align-top text-[0.62em] font-bold text-ink3">$</span>
      {value % 1 === 0 ? value : value.toFixed(2)}
    </span>
  );
}

/** Buy Now — opens the official brand site / retailer in a new tab. */
export function BuyButton({
  product,
  className,
  full,
  size = "sm",
}: {
  product: ShopProduct;
  className?: string;
  full?: boolean;
  size?: "sm" | "lg";
}) {
  return (
    <a
      href={buyUrlFor(product)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-brand-400 to-brand-600 font-semibold tracking-[0.01em] text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:shadow-glow-lg hover:brightness-[1.05] active:scale-[0.97]",
        size === "lg" ? "h-11 px-6 text-[14px]" : "h-9 px-4 text-[12.5px]",
        full && "w-full",
        className
      )}
    >
      Buy Now
      <ExternalLink className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
    </a>
  );
}

/* --- Tags ----------------------------------------------------------------- */

const TAG_STYLE: Record<string, string> = {
  Pro: "bg-brand-500/10 text-brand-500",
  Beginner: "bg-success/10 text-success",
  "Ceramic safe": "bg-violet/10 text-violet",
  Machine: "bg-warning/10 text-warning",
  Hand: "bg-ink3/10 text-ink2",
};

export function productTags(p: ShopProduct): string[] {
  const t: string[] = [];
  if (p.pro) t.push("Pro");
  if (p.beginner) t.push("Beginner");
  if (p.ceramicSafe) t.push("Ceramic safe");
  if (p.machine) t.push("Machine");
  if (p.hand) t.push("Hand");
  return t;
}

export function TagChip({ label }: { label: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", TAG_STYLE[label] ?? "bg-line2 text-ink3")}>
      {label}
    </span>
  );
}

/* --- Product card --------------------------------------------------------- */

export function ProductCard({ product }: { product: ShopProduct }) {
  const brand = getBrand(product.brand);
  const cat = getCategory(product.category);
  const CatIcon = cat?.icon;
  const badge = productBadge(product);
  return (
    <Link
      to={`/shop/product/${product.id}`}
      className="surface gloss-card group relative flex flex-col rounded-2xl p-3 transition-[transform,box-shadow,border-color] duration-200 hover:border-brand-500/50 hover:shadow-lift"
    >
      {/* top-edge accent that reveals on hover */}
      <span className="pointer-events-none absolute inset-x-8 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-brand-500/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative">
        <ProductImage product={product} className="aspect-square w-full" showBrand={false} />
        {badge && <Badge badge={badge} className="absolute right-2.5 top-2.5" />}
        {cat && CatIcon && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-panel/85 px-2 py-1 text-[10px] font-semibold text-ink2 shadow-sm ring-1 ring-inset ring-white/10 backdrop-blur-md transition-transform duration-300 group-hover:-translate-y-0.5">
            <CatIcon className="h-3 w-3 text-brand-500" />
            {cat.name}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-1 pt-3.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-500/90 transition-colors group-hover:text-brand-600">
          {brand?.name}
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-[15px] font-bold leading-[1.25] tracking-tight text-ink">
          {product.name}
        </h3>
        <div className="mt-2">
          <Stars rating={product.rating} reviews={product.reviews} compact />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <Price value={product.price} className="text-[20px]" />
          <BuyButton product={product} className="group-hover:shadow-glow-lg group-hover:brightness-[1.04]" />
        </div>
      </div>
    </Link>
  );
}

/** A large editorial "hero product" card for the top of the Featured rail. */
export function FeaturedSpotlight({ product }: { product: ShopProduct }) {
  const brand = getBrand(product.brand);
  const badge = productBadge(product) ?? { emoji: "✨", label: "Featured", cls: "bg-brand-500 text-white" };
  return (
    <Link
      to={`/shop/product/${product.id}`}
      className="surface gloss-card group grid overflow-hidden rounded-2xl sm:grid-cols-[1.05fr_1fr]"
    >
      <div className="relative min-h-[220px]">
        <ProductImage product={product} className="h-full w-full !rounded-none" iconClass="h-28 w-28" showBrand={false} />
        <Badge badge={badge} className="absolute left-4 top-4" />
      </div>
      <div className="flex flex-col justify-center gap-3 p-6 sm:p-7">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-500">{brand?.name}</div>
        <h3 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{product.name}</h3>
        <p className="text-[13px] leading-relaxed text-ink3">{product.blurb}</p>
        <Stars rating={product.rating} reviews={product.reviews} />
        <div className="mt-1 flex items-center gap-3">
          <Price value={product.price} className="text-[24px]" />
          <BuyButton product={product} />
          <span className="ml-auto hidden items-center gap-1 text-[12.5px] font-semibold text-brand-500 sm:inline-flex">
            Details <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* --- Category & brand tiles ---------------------------------------------- */

export function CategoryCard({ category, count }: { category: ShopCategory; count: number }) {
  const Icon = category.icon;
  return (
    <Link
      to={`/shop/category/${category.slug}`}
      className="surface gloss-card group relative flex h-[100px] flex-col justify-between overflow-hidden rounded-2xl p-4 transition hover:border-brand-500/40 hover:shadow-lift"
    >
      <Icon
        className="pointer-events-none absolute -bottom-5 -right-4 h-24 w-24 text-brand-500/[0.08] transition-all duration-500 group-hover:scale-110 group-hover:text-brand-500/[0.14]"
        strokeWidth={1.3}
      />
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/15 to-violet/12 text-brand-500 ring-1 ring-inset ring-brand-500/10">
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <div className="relative">
        <div className="font-display text-[13.5px] font-bold tracking-tight text-ink">{category.name}</div>
        <div className="text-[11px] text-ink3">{count} products</div>
      </div>
    </Link>
  );
}

function initialsFor(name: string) {
  return name
    .replace(/[^A-Za-z0-9 &]/g, "")
    .split(/[\s&]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function BrandTile({ brand, count }: { brand: ShopBrand; count: number }) {
  return (
    <Link
      to={`/shop/brand/${brand.slug}`}
      className="surface gloss-card group flex items-center gap-3 rounded-2xl p-3 transition hover:border-brand-500/40 hover:shadow-lift"
    >
      <span className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-carbon-800 to-carbon-950 font-display text-[13px] font-extrabold tracking-tight text-white ring-1 ring-inset ring-white/10">
        <span className="relative">{initialsFor(brand.name)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[14px] font-bold tracking-tight text-ink">{brand.name}</div>
        <div className="truncate text-[11px] text-ink3">
          {brand.country ? `${brand.country} · ` : ""}
          {count} products
        </div>
      </div>
      <ArrowRight className="h-4 w-4 flex-none text-ink3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand-500" />
    </Link>
  );
}

/* --- Section rail --------------------------------------------------------- */

export function Rail({
  title,
  subtitle,
  to,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  to?: string;
  accent?: string; // small color bar
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={cn("h-6 w-1 rounded-full", accent ?? "bg-brand-500")} />
          <div>
            <h2 className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink3">{subtitle}</p>}
          </div>
        </div>
        {to && (
          <Link to={to} className="group flex flex-none items-center gap-1 text-[13px] font-semibold text-brand-500 hover:text-brand-600">
            See all
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

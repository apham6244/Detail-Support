import { Link, useParams } from "react-router-dom";
import { ChevronRight, ExternalLink, Store, ShieldCheck, Check } from "lucide-react";
import {
  products,
  getProduct,
  getBrand,
  getCategory,
  buyUrlFor,
} from "@/lib/shopCatalog";
import {
  ProductImage,
  Stars,
  Price,
  ProductCard,
  productBadge,
} from "@/components/shop/ShopUI";
import { EmptyArt } from "@/components/ui/EmptyArt";
import { cn } from "@/lib/cn";

/** Short, scannable "why buy" lines derived from the product's own attributes. */
function highlightsFor(p: ReturnType<typeof getProduct>): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.pro) out.push("Professional-grade — trusted in high-volume shops");
  if (p.beginner) out.push("Forgiving and beginner-friendly");
  if (p.ceramicSafe) out.push("Safe to use on ceramic-coated paint");
  if (p.machine && p.hand) out.push("Works by hand or by machine");
  else if (p.machine) out.push("Built for machine application");
  else if (p.hand) out.push("Quick, easy hand application");
  if (p.useCases?.length) out.push(`Great for ${p.useCases.slice(0, 3).join(", ")}`);
  return out.slice(0, 4);
}

export default function ShopProduct() {
  const { id } = useParams();
  const product = getProduct(id);

  if (!product) {
    return (
      <div className="animate-fade-up flex flex-col items-center gap-3 py-16 text-center">
        <EmptyArt variant="spray" className="w-[180px]" />
        <div className="font-display text-[17px] font-bold text-ink">Product not found</div>
        <Link to="/shop" className="text-[13px] font-semibold text-brand-500 hover:underline">Back to the shop</Link>
      </div>
    );
  }

  const brand = getBrand(product.brand);
  const cat = getCategory(product.category);
  const badge = productBadge(product);
  const highlights = highlightsFor(product);

  const specs = [
    { label: "Application", value: product.machine && product.hand ? "Hand + machine" : product.machine ? "Machine" : product.hand ? "Hand" : "—" },
    { label: "Level", value: product.pro && product.beginner ? "All levels" : product.pro ? "Professional" : product.beginner ? "Beginner" : "—" },
    { label: "Ceramic safe", value: product.ceramicSafe ? "Yes" : "—" },
    { label: "Budget", value: product.budget },
  ];

  const sameCat = products.filter((p) => p.id !== product.id && p.category === product.category);
  const sameBrand = products.filter((p) => p.id !== product.id && p.brand === product.brand && p.category !== product.category);
  const related = [...sameCat, ...sameBrand].slice(0, 4);

  return (
    <div className="animate-fade-up">
      <nav className="mb-5 flex flex-wrap items-center gap-1 text-[12.5px] text-ink3">
        <Link to="/shop" className="hover:text-brand-500">Shop</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {cat && (
          <>
            <Link to={`/shop/category/${cat.slug}`} className="hover:text-brand-500">{cat.name}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="truncate text-ink2">{product.name}</span>
      </nav>

      {/* Hero: stage + identity/buy */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        {/* Image stage */}
        <div className="surface relative flex items-center justify-center overflow-hidden rounded-3xl p-8 sm:p-12">
          {badge && (
            <span className={cn("absolute left-6 top-6 z-10 inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-[10px] font-bold uppercase tracking-[0.06em] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]", badge.cls)}>
              <span className="text-[12px] leading-none">{badge.emoji}</span>
              {badge.label}
            </span>
          )}
          <div className="relative w-full max-w-[400px]">
            <ProductImage product={product} className="aspect-square w-full rounded-2xl" iconClass="h-32 w-32" showBrand={false} />
            <div className="pointer-events-none absolute inset-x-10 -bottom-3 h-6 rounded-[50%] bg-black/15 blur-xl" />
          </div>
        </div>

        {/* Identity + buy */}
        <div className="flex flex-col lg:pt-2">
          {cat && (
            <Link
              to={`/shop/category/${cat.slug}`}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-panel2/60 px-2.5 py-1 text-[11.5px] font-semibold text-ink2 transition hover:border-brand-500/40 hover:text-brand-500"
            >
              <cat.icon className="h-3.5 w-3.5 text-brand-500" />
              {cat.name}
            </Link>
          )}
          {brand && (
            <Link to={`/shop/brand/${brand.slug}`} className="mt-3 text-[12px] font-bold uppercase tracking-[0.1em] text-brand-500 hover:underline">
              {brand.name}
            </Link>
          )}
          <h1 className="mt-1.5 font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[34px]">
            {product.name}
          </h1>

          <div className="mt-3">
            <Stars rating={product.rating} reviews={product.reviews} />
          </div>

          <p className="mt-4 text-[15px] leading-relaxed text-ink2">{product.blurb}</p>

          {/* Buy box */}
          <div className="mt-6 border-t border-line pt-6">
            <div className="flex items-baseline gap-2">
              <Price value={product.price} className="text-[32px]" />
              {product.price != null && <span className="text-[12.5px] text-ink3">indicative price</span>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <a
                href={buyUrlFor(product)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-brand-400 to-brand-600 px-7 text-[15px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:shadow-glow-lg hover:brightness-[1.05] active:scale-[0.98] sm:flex-none"
              >
                Buy Now
                <ExternalLink className="h-4 w-4" />
              </a>
              {brand && (
                <a
                  href={brand.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-panel px-5 text-[13.5px] font-semibold text-ink2 transition hover:border-ink3 hover:bg-panel2"
                >
                  <Store className="h-4 w-4" />
                  Visit {brand.name}
                </a>
              )}
            </div>
            <div className="mt-3.5 flex items-start gap-2 text-[12px] leading-relaxed text-ink3">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-brand-500" />
              <span>
                Detail Support doesn't sell or ship. Buy Now opens the official brand site or an authorized retailer in a
                new tab, where current pricing and stock are shown.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Details: why it's worth it */}
      <section className="mt-12 border-t border-line pt-9">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <div>
            <h2 className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-ink">Why detailers reach for it</h2>
            <p className="mt-3 max-w-prose text-[14.5px] leading-relaxed text-ink2">{product.detail ?? product.blurb}</p>
            {highlights.length > 0 && (
              <ul className="mt-5 flex flex-col gap-2.5">
                {highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-[13.5px] text-ink">
                    <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-success/12 text-success">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Spec card */}
          <div className="surface h-fit rounded-2xl p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink3">At a glance</div>
            <div className="mt-3 divide-y divide-line2">
              {specs.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-ink3">{s.label}</span>
                  <span className="text-[13px] font-semibold tnum text-ink">{s.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-ink3">Rating</span>
                <Stars rating={product.rating} reviews={product.reviews} compact />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-brand-500" />
            <h2 className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-ink">You might also need</h2>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

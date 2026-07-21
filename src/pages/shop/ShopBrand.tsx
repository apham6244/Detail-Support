import { Link, useParams } from "react-router-dom";
import { ChevronRight, ExternalLink, MapPin } from "lucide-react";
import {
  getBrand,
  productsForBrand,
  getCategory,
  categories,
  CATEGORY_GROUPS,
} from "@/lib/shopCatalog";
import { ProductCard } from "@/components/shop/ShopUI";
import { EmptyArt } from "@/components/ui/EmptyArt";

const initials = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 &]/g, "")
    .split(/[\s&]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function SectionHeader({ accent, title, subtitle }: { accent: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="h-6 w-1 flex-none rounded-full" style={{ backgroundColor: accent }} />
      <div>
        <h2 className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink3">{subtitle}</p>}
      </div>
    </div>
  );
}

const productGrid = "grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4";

export default function ShopBrand() {
  const { slug } = useParams();
  const brand = getBrand(slug);

  if (!brand) {
    return (
      <div className="animate-fade-up flex flex-col items-center gap-3 py-16 text-center">
        <EmptyArt variant="car" className="w-[180px]" />
        <div className="font-display text-[17px] font-bold text-ink">Brand not found</div>
        <Link to="/shop" className="text-[13px] font-semibold text-brand-500 hover:underline">Back to the shop</Link>
      </div>
    );
  }

  const accent = brand.accent ?? "#2E7BFF";
  const items = productsForBrand(brand.slug);
  const covers = categories.filter((c) => items.some((p) => p.category === c.slug));
  const byGroup = CATEGORY_GROUPS.map((group) => ({
    group,
    items: items.filter((p) => getCategory(p.category)?.group === group),
  })).filter((g) => g.items.length > 0);

  const showFeatured = items.length >= 5;
  const featured = [...items].sort((a, b) => b.reviews - a.reviews).slice(0, 3);
  const grouped = byGroup.length >= 2;

  return (
    <div className="animate-fade-up">
      <nav className="mb-3 flex items-center gap-1 text-[12.5px] text-ink3">
        <Link to="/shop" className="hover:text-brand-500">Shop</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-ink2">{brand.name}</span>
      </nav>

      {/* Large accent header */}
      <header className="relative overflow-hidden rounded-2xl shadow-hero-dark">
        <div className="hero-carbon absolute inset-0" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(90% 130% at 10% -20%, ${accent}55, transparent 55%)` }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(80% 120% at 100% 120%, ${accent}22, transparent 55%)` }} />
        <div className="absolute inset-0 bg-paint-gloss opacity-35" />
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        <div className="relative px-6 py-9 sm:px-10 sm:py-11">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-4">
              <span
                className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-carbon-700 to-carbon-950 font-display text-[20px] font-extrabold tracking-tight text-white"
                style={{ boxShadow: `0 0 0 1.5px ${accent}, 0 12px 30px -8px ${accent}99` }}
              >
                {initials(brand.name)}
              </span>
              <div>
                {brand.tagline && (
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                    {brand.tagline}
                  </div>
                )}
                <h1 className="mt-1 font-display text-[28px] font-extrabold tracking-[-0.025em] text-white sm:text-[34px]">{brand.name}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/55">
                  {brand.country && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {brand.country}
                    </span>
                  )}
                  <span>{items.length} products</span>
                  {byGroup.length > 1 && <span>{byGroup.length} collections</span>}
                </div>
              </div>
            </div>
            <a
              href={brand.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 flex-none items-center gap-2 rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 px-5 text-[13.5px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:shadow-glow-lg hover:brightness-[1.05] active:scale-[0.98]"
            >
              Visit official site
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-white/75">{brand.blurb}</p>

          {covers.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {covers.map((c) => (
                <span
                  key={c.slug}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium text-white/85"
                  style={{ borderColor: `${accent}55`, backgroundColor: `${accent}1f` }}
                >
                  <c.icon className="h-3 w-3" style={{ color: accent }} />
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Signature products */}
      {showFeatured && (
        <section className="mt-9">
          <SectionHeader accent={accent} title="Signature products" subtitle={`The ${brand.name} gear detailers reach for first`} />
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Collections by category group, or a single range */}
      {grouped ? (
        byGroup.map(({ group, items: gItems }) => (
          <section key={group} className="mt-9">
            <SectionHeader accent={accent} title={group} subtitle={`${gItems.length} ${gItems.length === 1 ? "product" : "products"}`} />
            <div className={productGrid}>
              {gItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="mt-9">
          <SectionHeader accent={accent} title={`The ${brand.name} range`} />
          <div className={productGrid}>
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

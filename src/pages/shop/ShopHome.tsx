import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  categories,
  brands,
  products,
  CATEGORY_GROUPS,
  featuredProducts,
  bestSellers,
  recentlyAdded,
  staffPicks,
  productCountForCategory,
  productCountForBrand,
} from "@/lib/shopCatalog";
import { DetailImage } from "@/components/ui/DetailImage";
import { PHOTO, unsplash } from "@/lib/imagery";
import {
  ProductCard,
  Rail,
  CategoryCard,
  BrandTile,
  FeaturedSpotlight,
} from "@/components/shop/ShopUI";

export default function ShopHome() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/shop/browse?q=${encodeURIComponent(q.trim())}` : "/shop/browse");
  };

  const grid = "grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4";
  const feat = featuredProducts();
  const [spotlight, ...restFeatured] = feat;

  const stats = [
    { n: brands.length, l: "Pro brands" },
    { n: products.length, l: "Products" },
    { n: categories.length, l: "Categories" },
  ];

  return (
    <div className="animate-fade-up">
      {/* Immersive hero */}
      <div className="relative min-h-[300px] overflow-hidden rounded-2xl shadow-hero-dark sm:min-h-[340px]">
        <DetailImage src={unsplash(PHOTO.glossyBlack, { w: 1600, q: 62 })} alt="Detailed car with deep gloss" className="absolute inset-0" eager />
        <div className="absolute inset-0 bg-gradient-to-r from-carbon-950 via-carbon-950/88 to-carbon-950/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon-950/85 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-paint-gloss opacity-60" />
        <div className="relative flex min-h-[300px] flex-col justify-center px-6 py-10 sm:min-h-[340px] sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
            </span>
            The Detailer's Marketplace
          </div>
          <h1 className="font-display mt-3 max-w-2xl text-[30px] font-extrabold leading-[1.02] tracking-[-0.03em] text-white sm:text-[42px]">
            Every pro brand.
            <br className="hidden sm:block" /> <span className="text-brand-300">One place.</span>
          </h1>
          <p className="mt-3.5 max-w-lg text-[14px] leading-relaxed text-white/70">
            The gear the best detailers actually run — curated, compared, and linked straight to the official brand or an
            authorized retailer.
          </p>

          <form onSubmit={submit} className="mt-6 flex max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/45" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products, brands, or use case…"
                className="h-[52px] w-full rounded-2xl border border-white/12 bg-white/[0.08] pl-12 pr-3 text-[14.5px] text-white placeholder:text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md focus:border-brand-400/60 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-[52px] flex-none items-center gap-2 rounded-2xl bg-gradient-to-b from-brand-400 to-brand-600 px-6 text-[14.5px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:shadow-glow-lg hover:brightness-[1.05] active:scale-[0.98]"
            >
              Search
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-white/40">Trending:</span>
            {["Ceramic coatings", "Snow foam", "Polishers", "Microfiber towels"].map((t) => (
              <Link
                key={t}
                to={`/shop/browse?q=${encodeURIComponent(t)}`}
                className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-white/75 transition hover:border-brand-400/50 hover:bg-white/[0.12] hover:text-white"
              >
                {t}
              </Link>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-6">
            {stats.map((s) => (
              <div key={s.l}>
                <div className="font-display text-[22px] font-extrabold leading-none tnum text-white">{s.n}</div>
                <div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-white/45">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      <section className="mt-11">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-brand-500" />
            <h2 className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-ink">Shop by category</h2>
          </div>
          <Link to="/shop/browse" className="flex-none text-[13px] font-semibold text-brand-500 hover:underline">
            Browse all →
          </Link>
        </div>
        <div className="space-y-5">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group}>
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink3">{group}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {categories
                  .filter((c) => c.group === group)
                  .map((c) => (
                    <CategoryCard key={c.slug} category={c} count={productCountForCategory(c.slug)} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured — spotlight + rail */}
      <Rail title="Featured" subtitle="Hand-picked gear worth your bay space" to="/shop/browse">
        {spotlight && <FeaturedSpotlight product={spotlight} />}
        {restFeatured.length > 0 && (
          <div className={`${grid} mt-3.5`}>
            {restFeatured.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </Rail>

      <Rail title="Best sellers" subtitle="What detailers reorder the most" to="/shop/browse?sort=popular" accent="bg-warning">
        <div className={grid}>
          {bestSellers().slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Rail>

      <Rail title="Staff picks" subtitle="Our team's current favorites" accent="bg-violet">
        <div className={grid}>
          {staffPicks().slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Rail>

      <Rail title="Recently added" subtitle="Fresh to the marketplace" to="/shop/browse?sort=newest" accent="bg-success">
        <div className={grid}>
          {recentlyAdded(8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Rail>

      {/* Brands */}
      <section className="mt-12">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-brand-500" />
          <h2 className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-ink">Shop by brand</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((b) => (
            <BrandTile key={b.slug} brand={b} count={productCountForBrand(b.slug)} />
          ))}
        </div>
      </section>

      <p className="mt-10 text-center text-[11.5px] text-ink3">
        Prices are indicative and set by each retailer. Buy Now opens the official brand site or an authorized seller.
      </p>
    </div>
  );
}

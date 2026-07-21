import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X, ChevronRight } from "lucide-react";
import {
  products,
  brands,
  categories,
  productsForCategory,
  getCategory,
  brandName,
  categoryName,
  searchProducts,
  applyFilters,
  sortProducts,
  emptyFilters,
  type ShopFilters,
  type BudgetTier,
  type SortKey,
} from "@/lib/shopCatalog";
import { ProductCard } from "@/components/shop/ShopUI";
import { EmptyArt } from "@/components/ui/EmptyArt";
import { cn } from "@/lib/cn";

const BUDGETS: { tier: BudgetTier; label: string }[] = [
  { tier: "$", label: "$" },
  { tier: "$$", label: "$$" },
  { tier: "$$$", label: "$$$" },
];

const TOGGLES: { key: keyof ShopFilters; label: string }[] = [
  { key: "pro", label: "Professional grade" },
  { key: "beginner", label: "Beginner friendly" },
  { key: "ceramicSafe", label: "Ceramic safe" },
  { key: "machine", label: "Machine use" },
  { key: "hand", label: "Hand use" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "newest", label: "Newest" },
  { key: "rating", label: "Top rated" },
  { key: "price-low", label: "Price: low to high" },
  { key: "price-high", label: "Price: high to low" },
];

export default function ShopBrowse() {
  const { slug } = useParams();
  const scopedCat = getCategory(slug);
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const sort = (params.get("sort") as SortKey) || "popular";
  const [filters, setFilters] = useState<ShopFilters>(emptyFilters());
  const [showFilters, setShowFilters] = useState(false);

  const setQueryAndUrl = (v: string) => {
    setQuery(v);
    const next = new URLSearchParams(params);
    if (v.trim()) next.set("q", v.trim());
    else next.delete("q");
    setParams(next, { replace: true });
  };
  const setSort = (v: SortKey) => {
    const next = new URLSearchParams(params);
    next.set("sort", v);
    setParams(next, { replace: true });
  };

  const results = useMemo(() => {
    const base = scopedCat ? productsForCategory(scopedCat.slug) : products;
    const searched = searchProducts(query, base);
    // when scoped to a category, the category filter is hidden, so blank it out
    const effective: ShopFilters = scopedCat ? { ...filters, categories: [] } : filters;
    return sortProducts(applyFilters(searched, effective), sort);
  }, [scopedCat, query, filters, sort]);

  const activeCount =
    filters.brands.length +
    (scopedCat ? 0 : filters.categories.length) +
    filters.budgets.length +
    TOGGLES.filter((t) => filters[t.key]).length;

  const toggleArray = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const chips: { label: string; onRemove: () => void }[] = [
    ...filters.brands.map((b) => ({ label: brandName(b), onRemove: () => setFilters((f) => ({ ...f, brands: f.brands.filter((x) => x !== b) })) })),
    ...(scopedCat ? [] : filters.categories.map((c) => ({ label: categoryName(c), onRemove: () => setFilters((f) => ({ ...f, categories: f.categories.filter((x) => x !== c) })) }))),
    ...filters.budgets.map((b) => ({ label: `Budget ${b}`, onRemove: () => setFilters((f) => ({ ...f, budgets: f.budgets.filter((x) => x !== b) })) })),
    ...TOGGLES.filter((t) => filters[t.key]).map((t) => ({ label: t.label, onRemove: () => setFilters((f) => ({ ...f, [t.key]: false })) })),
  ];

  const heading = scopedCat ? scopedCat.name : query ? `“${query}”` : "All products";

  const onSearchSubmit = (e: FormEvent) => e.preventDefault();

  return (
    <div className="animate-fade-up">
      {/* Breadcrumb + heading */}
      <nav className="mb-3 flex items-center gap-1 text-[12.5px] text-ink3">
        <Link to="/shop" className="hover:text-brand-500">Shop</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-ink2">{scopedCat ? scopedCat.name : "Browse"}</span>
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.02em] text-ink">{heading}</h1>
          <p className="mt-1 text-[13px] text-ink3">
            {results.length} {results.length === 1 ? "product" : "products"}
            {scopedCat && <> · <Link to="/shop/browse" className="font-semibold text-brand-500 hover:underline">browse everything</Link></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-[12.5px] font-semibold text-ink2 transition hover:border-ink3 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ""}
          </button>
          <label className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 cursor-pointer appearance-none rounded-lg border border-line bg-panel pl-3 pr-8 text-[12.5px] font-semibold text-ink2 transition hover:border-ink3 focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-ink3" />
          </label>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={onSearchSubmit} className="mb-6">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink3" />
          <input
            value={query}
            onChange={(e) => setQueryAndUrl(e.target.value)}
            placeholder="Search products, brands, or use case…"
            className="h-11 w-full rounded-xl border border-line bg-panel2 pl-11 pr-9 text-[14px] text-ink placeholder:text-ink3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {query && (
            <button
              onClick={() => setQueryAndUrl("")}
              type="button"
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink3 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-[236px_1fr]">
        {/* Filters */}
        <aside className={cn("lg:block", showFilters ? "block" : "hidden")}>
          <div className="surface rounded-2xl p-4 lg:sticky lg:top-[76px]">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-[14px] font-bold tracking-tight text-ink">Filters</span>
              {activeCount > 0 && (
                <button
                  onClick={() => setFilters(emptyFilters())}
                  className="text-[12px] font-semibold text-brand-500 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            <FilterGroup title="Attributes">
              <div className="flex flex-col gap-1.5">
                {TOGGLES.map((t) => (
                  <ToggleRow
                    key={t.key}
                    label={t.label}
                    checked={Boolean(filters[t.key])}
                    onChange={() => setFilters((f) => ({ ...f, [t.key]: !f[t.key] }))}
                  />
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Budget">
              <div className="flex gap-1.5">
                {BUDGETS.map((b) => {
                  const on = filters.budgets.includes(b.tier);
                  return (
                    <button
                      key={b.tier}
                      onClick={() => setFilters((f) => ({ ...f, budgets: toggleArray(f.budgets, b.tier) }))}
                      className={cn(
                        "h-8 flex-1 rounded-lg border text-[13px] font-bold tnum transition",
                        on ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-line text-ink3 hover:border-ink3"
                      )}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </FilterGroup>

            {!scopedCat && (
              <FilterGroup title="Category" scroll>
                {categories.map((c) => (
                  <CheckRow
                    key={c.slug}
                    label={c.name}
                    checked={filters.categories.includes(c.slug)}
                    onChange={() => setFilters((f) => ({ ...f, categories: toggleArray(f.categories, c.slug) }))}
                  />
                ))}
              </FilterGroup>
            )}

            <FilterGroup title="Brand" scroll>
              {brands.map((b) => (
                <CheckRow
                  key={b.slug}
                  label={b.name}
                  checked={filters.brands.includes(b.slug)}
                  onChange={() => setFilters((f) => ({ ...f, brands: toggleArray(f.brands, b.slug) }))}
                />
              ))}
            </FilterGroup>
          </div>
        </aside>

        {/* Results */}
        <div>
          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((c, i) => (
                <button
                  key={i}
                  onClick={c.onRemove}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel py-1 pl-3 pr-2 text-[12px] font-medium text-ink2 transition hover:border-brand-500/40 hover:text-ink"
                >
                  {c.label}
                  <X className="h-3 w-3 text-ink3" />
                </button>
              ))}
              <button onClick={() => setFilters(emptyFilters())} className="ml-1 text-[12px] font-semibold text-brand-500 hover:underline">
                Clear all
              </button>
            </div>
          )}
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-line py-14 text-center">
              <EmptyArt variant="spray" className="w-[170px]" />
              <div className="font-display text-[16px] font-bold text-ink">No products match</div>
              <p className="max-w-xs text-[13px] text-ink3">Try a different search or clear a filter or two.</p>
              {(activeCount > 0 || query) && (
                <button
                  onClick={() => {
                    setFilters(emptyFilters());
                    setQueryAndUrl("");
                  }}
                  className="text-[13px] font-semibold text-brand-500 hover:underline"
                >
                  Reset everything
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children, scroll }: { title: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div className="border-t border-line py-3.5 first:border-t-0 first:pt-0">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink3">{title}</div>
      <div className={cn(scroll && "scrollbar-slim max-h-52 overflow-y-auto pr-1")}>{children}</div>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="flex w-full items-center gap-2 py-1 text-left">
      <span
        className={cn(
          "flex h-4 w-4 flex-none items-center justify-center rounded border transition",
          checked ? "border-brand-500 bg-brand-500 text-white" : "border-line"
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={cn("text-[12.5px]", checked ? "font-medium text-ink" : "text-ink2")}>{label}</span>
    </button>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="flex w-full items-center justify-between gap-2 py-0.5 text-left">
      <span className={cn("text-[12.5px]", checked ? "font-medium text-ink" : "text-ink2")}>{label}</span>
      <span
        className={cn(
          "relative h-[18px] w-8 flex-none rounded-full transition-colors",
          checked ? "bg-brand-500" : "bg-line2"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-[14px] w-[14px] rounded-full bg-white shadow transition-all",
            checked ? "left-[17px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

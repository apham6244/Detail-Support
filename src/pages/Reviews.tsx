import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import {
  Star, Search, Loader2, RefreshCw, ExternalLink, Link2Off, Building2, Info,
  MapPin, MessageSquare, CalendarDays, TrendingUp, AlertCircle, Reply,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/data";
import { useGoogleReviews, type BusinessMatch, type GoogleReview } from "@/hooks/useGoogleReviews";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const AXIS = "#7E8AA3";
const tooltipStyle = {
  borderRadius: 10, border: "1px solid rgba(126,138,163,.25)",
  background: "rgb(var(--panel))", color: "rgb(var(--ink))", fontSize: 12,
};
const RATING_COLOR = ["#E5484D", "#E5734D", "#E0A100", "#8FBF3F", "#17A867"]; // 1→5

function lastMonths(n: number) {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString(undefined, { month: "short" }) });
  }
  return out;
}
const monthKeyOf = (iso: string) => iso.slice(0, 7);

type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";
type Sort = "newest" | "oldest" | "highest" | "lowest";

export default function Reviews() {
  const { configured, connected, data, loading, error, search, connect, disconnect, refresh } = useGoogleReviews();
  const { role } = useAuth();
  const canManage = role !== "employee";

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Reviews"
        subtitle="Your Google Business Profile reviews, synced automatically"
        actions={
          connected ? (
            <div className="flex gap-2">
              <button
                onClick={refresh}
                disabled={loading}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink2 transition hover:border-ink3 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
              </button>
              {canManage && (
                <button
                  onClick={disconnect}
                  className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink3 transition hover:border-danger/50 hover:text-danger"
                >
                  <Link2Off className="h-3.5 w-3.5" /> Disconnect
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {configured === null ? (
        <Loading />
      ) : configured === false ? (
        <NotConfigured />
      ) : !connected ? (
        <Onboarding search={search} connect={connect} loading={loading} error={error} canManage={canManage} />
      ) : (
        <Dashboard data={data} loading={loading} error={error} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// State 1 — the server has no Google key
// ---------------------------------------------------------------------------

function NotConfigured() {
  return (
    <div className="surface mx-auto max-w-2xl rounded-2xl p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-violet/15 text-brand-500">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="font-display mt-4 text-[19px] font-bold tracking-tight text-ink">Google reviews aren't switched on yet</h2>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink3">
        Reviews are read live from Google — nothing is stored or edited in Detail Support. To enable it, add a Google
        Places API key on the server.
      </p>
      <ol className="mx-auto mt-5 max-w-md space-y-2 text-left text-[13px] text-ink2">
        <Step n={1}>Create a project in the Google Cloud Console.</Step>
        <Step n={2}>Enable <span className="font-semibold text-ink">Places API (New)</span>.</Step>
        <Step n={3}>Create an API key and set <code className="rounded bg-panel2 px-1.5 py-0.5 text-[12px] text-brand-500">GOOGLE_PLACES_API_KEY</code> in <code className="rounded bg-panel2 px-1.5 py-0.5 text-[12px] text-brand-500">server/.env</code>.</Step>
        <Step n={4}>Restart the API server, then reload this page.</Step>
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-500/12 text-[11px] font-bold text-brand-500">{n}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// State 2 — connect a business
// ---------------------------------------------------------------------------

function Onboarding({ search, connect, loading, error, canManage }: {
  search: (q: string) => Promise<BusinessMatch[]>;
  connect: (placeId: string) => Promise<unknown>;
  loading: boolean;
  error: string | null;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusinessMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Debounced search as they type.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearchError(null); return; }
    setSearching(true);
    setTouched(true);
    const t = setTimeout(async () => {
      try {
        setResults(await search(q));
        setSearchError(null);
      } catch (e) {
        setSearchError((e as Error).message);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="surface relative overflow-hidden rounded-2xl p-8 text-center">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-violet/15 text-brand-500">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="font-display mt-4 text-[21px] font-bold tracking-tight text-ink">Connect your Google Business Profile</h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink3">
            Connect your Google Business Profile to automatically sync and display your Google Reviews. Search for your
            business below — you only have to do this once.
          </p>

          <div className="relative mx-auto mt-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-ink3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your business name…"
              autoFocus
              className="input h-11 pl-9 text-[14px]"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink3" />}
          </div>

          {!canManage && (
            <p className="mt-3 text-[12.5px] text-ink3">Ask an owner or manager to connect the business profile.</p>
          )}
        </div>
      </div>

      {(searchError || error) && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-danger/10 px-4 py-3 text-[12.5px] text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" /> {searchError ?? error}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line">
          <div className="divide-y divide-line">
            {results.map((r) => (
              <div key={r.placeId} className="flex items-center gap-3 px-4 py-3 transition hover:bg-panel2/60">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <MapPin className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{r.name}</div>
                  <div className="truncate text-[12px] text-ink3">{r.address ?? "No address listed"}</div>
                  {r.rating != null && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <StarRow rating={r.rating} size={12} />
                      <span className="text-[11.5px] text-ink3">{r.rating.toFixed(1)} · {r.totalReviews ?? 0} reviews</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => { setConnectingId(r.placeId); try { await connect(r.placeId); } finally { setConnectingId(null); } }}
                  disabled={!canManage || loading}
                  className="inline-flex h-9 flex-none items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-3.5 text-[13px] font-semibold text-white shadow-glow transition hover:shadow-glow-lg active:scale-95 disabled:opacity-50"
                >
                  {connectingId === r.placeId ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</> : "Connect"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {touched && !searching && !results.length && query.trim().length >= 2 && !searchError && (
        <div className="mt-4 border-y border-line px-4 py-10 text-center text-[13px] text-ink3">
          No businesses found for “{query}”. Try the exact name on your Google listing.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// State 3 — connected dashboard
// ---------------------------------------------------------------------------

function Dashboard({ data, loading, error }: {
  data: ReturnType<typeof useGoogleReviews>["data"];
  loading: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const reviews = data?.reviews ?? [];

  const synced = reviews.length;
  const newThisMonth = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return reviews.filter((r) => r.publishedAt && monthKeyOf(r.publishedAt) === key).length;
  }, [reviews]);

  const distribution = useMemo(
    () => [5, 4, 3, 2, 1].map((star) => ({ star, label: `${star}★`, count: reviews.filter((r) => r.rating === star).length })),
    [reviews]
  );

  const monthly = useMemo(() => {
    const months = lastMonths(6);
    const counts = new Map(months.map((m) => [m.key, 0]));
    for (const r of reviews) {
      if (!r.publishedAt) continue;
      const k = monthKeyOf(r.publishedAt);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return months.map((m) => ({ label: m.label, count: counts.get(m.key) ?? 0 }));
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = reviews.filter((r) => {
      if (rating !== "all" && r.rating !== Number(rating)) return false;
      if (q && !`${r.author} ${r.text ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const time = (r: GoogleReview) => (r.publishedAt ? new Date(r.publishedAt).getTime() : 0);
    list = list.slice().sort((a, b) => {
      switch (sort) {
        case "oldest": return time(a) - time(b);
        case "highest": return b.rating - a.rating || time(b) - time(a);
        case "lowest": return a.rating - b.rating || time(b) - time(a);
        default: return time(b) - time(a);
      }
    });
    return list;
  }, [reviews, query, rating, sort]);

  if (loading && !data) return <Loading />;
  if (error && !data) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" /> {error}
      </div>
    );
  }
  if (!data) return <Loading />;

  return (
    <>
      {/* Connected business */}
      <div className="surface flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[16px] font-bold tracking-tight text-ink">{data.business.name}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10.5px] font-semibold text-success ring-1 ring-inset ring-success/25">
              Connected
            </span>
          </div>
          <div className="truncate text-[12px] text-ink3">{data.business.address ?? "Google Business Profile"}</div>
        </div>
        {data.mapsUrl && (
          <a
            href={data.mapsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink2 transition hover:border-brand-500/50 hover:text-brand-500"
          >
            View on Google <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* KPI band */}
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 border-y border-line py-6 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-line">
        <Kpi icon={Star} accent="amber" label="Google rating" value={data.rating != null ? data.rating.toFixed(1) : "—"}
          sub={data.rating != null ? <StarRow rating={data.rating} size={12} /> : "No rating yet"} />
        <Kpi icon={MessageSquare} accent="brand" label="Total reviews" value={String(data.totalReviews ?? 0)} sub="All time on Google" />
        <Kpi icon={TrendingUp} accent="violet" label="Synced reviews" value={String(synced)} sub="Shown below" />
        <Kpi icon={CalendarDays} accent="success" label="New this month" value={String(newThisMonth)} sub="Of synced reviews" />
      </div>

      {/* Honest note about the API's cap */}
      {data.sampled && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-panel2/40 px-4 py-3 text-[12px] leading-relaxed text-ink3">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-none" />
          <p>
            Your rating and total review count above are Google's official figures. Google's public API returns only the{" "}
            <span className="font-medium text-ink2">{data.reviewLimit ?? synced} most relevant reviews</span>, so the list and
            charts below are based on those {synced}. Owner replies aren't available through this API — connecting via the
            Google Business Profile API would unlock your full history and replies.
          </p>
        </div>
      )}

      {/* Charts */}
      <div className="mt-8 grid gap-x-12 gap-y-8 border-t border-line pt-8 lg:grid-cols-2">
        <ChartBlock title="Rating distribution" subtitle={`Across ${synced} synced reviews`}>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={distribution} layout="vertical" margin={{ top: 6, right: 12, bottom: 0, left: 6 }}>
              <CartesianGrid horizontal={false} stroke={AXIS} strokeOpacity={0.12} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(126,138,163,.08)" }} />
              <Bar dataKey="count" name="Reviews" radius={[0, 5, 5, 0]} barSize={18}>
                {distribution.map((d) => <Cell key={d.star} fill={RATING_COLOR[d.star - 1]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartBlock>

        <ChartBlock title="Reviews over time" subtitle="Last 6 months">
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={monthly} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="gRevFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E7BFF" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2E7BFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={AXIS} strokeOpacity={0.15} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" name="Reviews" stroke="#2E7BFF" strokeWidth={2.5} fill="url(#gRevFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBlock>
      </div>

      {/* Controls */}
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-8">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[300px]">
          <Search className="pointer-events-none absolute left-2.5 top-[9px] h-[17px] w-[17px] text-ink3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reviews…" className="input pl-8" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input h-10 w-auto cursor-pointer text-[13px] font-medium">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest rating</option>
          <option value="lowest">Lowest rating</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(["all", "5", "4", "3", "2", "1"] as RatingFilter[]).map((r) => (
          <button
            key={r} onClick={() => setRating(r)}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition",
              rating === r ? "bg-brand-500/12 text-brand-500 ring-1 ring-inset ring-brand-500/25" : "text-ink3 hover:bg-line2 hover:text-ink"
            )}
          >
            {r === "all" ? "All ratings" : <>{r}<Star className="h-3 w-3 fill-warning text-warning" /></>}
          </button>
        ))}
      </div>

      {/* Reviews */}
      {filtered.length === 0 ? (
        <div className="mt-6 border-y border-line px-4 py-14 text-center text-[13px] text-ink3">
          {reviews.length === 0 ? "Google hasn't returned any reviews for this business yet." : "No reviews match your filters."}
        </div>
      ) : (
        <div className="mt-5 grid gap-3.5 lg:grid-cols-2">
          {filtered.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}

      <p className="mt-8 pb-4 text-center text-[11.5px] text-ink3">Reviews from Google · updated live, read-only</p>
    </>
  );
}

// ---------------------------------------------------------------------------

const ACCENT: Record<string, string> = { brand: "text-brand-500", amber: "text-warning", violet: "text-violet", success: "text-success" };

function Kpi({ icon: Icon, accent, label, value, sub }: {
  icon: typeof Star; accent: keyof typeof ACCENT; label: string; value: string; sub: React.ReactNode;
}) {
  return (
    <div className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-4 w-4", ACCENT[accent])} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">{label}</span>
      </div>
      <div className="mt-2 font-display text-[26px] font-bold leading-none tracking-tight tnum text-ink">{value}</div>
      <div className="mt-2 truncate text-xs text-ink3">{sub}</div>
    </div>
  );
}

function ChartBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <span className="text-[12px] font-medium text-ink3">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

/** Google-style stars with fractional fill (4.6 → four and a bit). */
export function StarRow({ rating, size = 15 }: { rating: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const row = (cls: string) => (
    <span className="flex flex-none gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={cls} />
      ))}
    </span>
  );
  return (
    <span className="relative inline-flex align-middle" title={`${rating.toFixed(1)} out of 5`}>
      {row("fill-line2 text-line2")}
      <span className="absolute left-0 top-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("fill-warning text-warning")}
      </span>
    </span>
  );
}

function ReviewCard({ review }: { review: GoogleReview }) {
  const when = review.relativeTime ?? (review.publishedAt ? new Date(review.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
  return (
    <div className="surface gloss-card flex flex-col rounded-2xl p-4">
      <div className="flex items-start gap-3">
        {review.authorPhoto ? (
          <img src={review.authorPhoto} alt="" loading="lazy" className="h-10 w-10 flex-none rounded-full object-cover ring-1 ring-inset ring-line" />
        ) : (
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[13px] font-bold uppercase text-white">
            {review.author.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink">{review.author}</div>
          <div className="mt-1 flex items-center gap-2">
            <StarRow rating={review.rating} size={13} />
            <span className="text-[11.5px] text-ink3">{when}</span>
          </div>
        </div>
      </div>

      {review.text && <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink2">{review.text}</p>}

      {review.ownerResponse && (
        <div className="mt-3 rounded-xl bg-brand-500/[0.06] p-3">
          <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-brand-500">
            <Reply className="h-3.5 w-3.5" /> Owner response
          </div>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink2">{review.ownerResponse.text}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Route chunk prefetching. Every page is a lazy `import()` in App.tsx, so the
 * first visit to a route pays a network hop for its JS chunk. Warming that
 * chunk the moment a user *hovers* (or focuses / touches) a nav link makes the
 * click feel instant — the module is already parsed by the time they release.
 *
 * These loaders point at the same module ids App.tsx lazy-loads; Vite dedupes
 * dynamic imports by resolved path, so a prefetch here and the `lazy()` there
 * share one chunk and one cache entry.
 */
type Loader = () => Promise<unknown>;

const ROUTE_LOADERS: Record<string, Loader> = {
  "/": () => import("@/pages/Dashboard"),
  "/customers": () => import("@/pages/Customers"),
  "/vehicles": () => import("@/pages/VehicleDetail"),
  "/leads": () => import("@/pages/Leads"),
  "/reviews": () => import("@/pages/Reviews"),
  "/appointments": () => import("@/pages/Appointments"),
  "/schedule": () => import("@/pages/Schedule"),
  "/invoices": () => import("@/pages/Invoices"),
  "/quotes": () => import("@/pages/Quotes"),
  "/services": () => import("@/pages/Services"),
  "/analytics": () => import("@/pages/Analytics"),
  "/marketing": () => import("@/pages/Marketing"),
  "/performance": () => import("@/pages/Performance"),
  "/gear-guide": () => import("@/pages/GearGuide"),
  "/team": () => import("@/pages/Team"),
  "/billing": () => import("@/pages/Billing"),
  "/settings": () => import("@/pages/Settings"),
};

const warmed = new Set<string>();

/** Longest-prefix match so "/customers/123" still warms the Customers chunk. */
function keyFor(path: string): string | undefined {
  return Object.keys(ROUTE_LOADERS)
    .filter((k) => (k === "/" ? path === "/" : path === k || path.startsWith(k + "/") || path.startsWith(k)))
    .sort((a, b) => b.length - a.length)[0];
}

// Schedule off the critical path, but with a `timeout` so a busy main thread or
// a briefly-backgrounded tab can't starve the prefetch indefinitely.
const idle: (cb: () => void) => void =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => (window as unknown as { requestIdleCallback: (c: () => void, o?: { timeout: number }) => void }).requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => window.setTimeout(cb, 200);

/** Prefetch the chunk for a route path. No-ops after the first call per chunk. */
export function prefetchRoute(path: string): void {
  const key = keyFor(path);
  if (!key || warmed.has(key)) return;
  warmed.add(key);
  // Defer so it never competes with the click/navigation the user just made.
  idle(() => {
    ROUTE_LOADERS[key]!().catch(() => warmed.delete(key)); // let a failed load retry later
  });
}

/** Warm the handful of routes a signed-in user almost always visits next. */
export function prefetchLikelyRoutes(): void {
  idle(() => ["/customers", "/appointments", "/invoices"].forEach(prefetchRoute));
}

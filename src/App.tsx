import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DSIcon } from "./components/brand/Logo";
import { useAuth } from "./lib/auth";
import { isDemo, startDemo } from "./lib/demo";

// Public
const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));

// App (protected)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Leads = lazy(() => import("./pages/Leads"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Services = lazy(() => import("./pages/Services"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Marketing = lazy(() => import("./pages/Marketing"));
const Performance = lazy(() => import("./pages/Performance"));
const GearGuide = lazy(() => import("./pages/GearGuide"));
const Team = lazy(() => import("./pages/Team"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const ShopHome = lazy(() => import("./pages/shop/ShopHome"));
const ShopBrowse = lazy(() => import("./pages/shop/ShopBrowse"));
const ShopBrand = lazy(() => import("./pages/shop/ShopBrand"));
const ShopProduct = lazy(() => import("./pages/shop/ShopProduct"));

/**
 * Branded boot screen. This is the first thing anyone sees, so it carries the
 * mark rather than a generic spinner: a softly pulsing brand halo behind the
 * logo and a slim indeterminate sweep. Reduced-motion users get it static.
 */
function Splash() {
  return (
    <div className="relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden bg-ground">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/10 blur-[110px]" />
      <div className="relative flex flex-col items-center">
        <div className="relative">
          <span aria-hidden className="absolute -inset-3 rounded-[22px] bg-brand-500/25 blur-xl motion-safe:animate-pulse" />
          <DSIcon size={54} className="relative" />
        </div>
        <div className="mt-4 font-display text-[16px] font-bold tracking-tight text-ink">Detail Support</div>
        <div className="mt-1 text-[12.5px] text-ink3">Getting your shop ready…</div>
        <div className="mt-5 h-[3px] w-40 overflow-hidden rounded-full bg-line2">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 motion-safe:animate-[splash-sweep_1.15s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`@keyframes splash-sweep{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  );
}

/**
 * /demo — a shareable, bookmarkable entry point to the sample workspace.
 * Turns demo mode on, then hands off with a REAL page load so every provider
 * re-initialises (AuthProvider sits above the router and reads isDemo() during
 * render, so a client-side navigate would leave it stale — see lib/demo.ts).
 */
function DemoEntry() {
  useEffect(() => {
    startDemo();
  }, []);
  return <Splash />;
}

/**
 * Gate the app shell: splash while loading, redirect to welcome if logged out.
 * Demo visitors are admitted too — `useAuth` supplies a synthetic read-only
 * identity in that case (and only when there's no real session).
 */
function RequireAuth() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <Splash />;
  if (!isAuthenticated && !isDemo()) return <Navigate to="/welcome" replace />;
  return <AppLayout />;
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        {/* Public */}
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/demo" element={<DemoEntry />} />

        {/* Protected app */}
        <Route element={<RequireAuth />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="leads" element={<Leads />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="services" element={<Services />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="performance" element={<Performance />} />
          <Route path="gear-guide" element={<GearGuide />} />
          {/* Shop — TEMPORARILY HIDDEN from the sidebar (see Sidebar.tsx), but
              fully preserved: routes, pages, shopCatalog.ts, and the image
              system stay intact so the marketplace can be re-enabled later once
              approved product images / affiliate / brand partnerships exist. */}
          <Route path="shop" element={<ShopHome />} />
          <Route path="shop/browse" element={<ShopBrowse />} />
          <Route path="shop/category/:slug" element={<ShopBrowse />} />
          <Route path="shop/brand/:slug" element={<ShopBrand />} />
          <Route path="shop/product/:id" element={<ShopProduct />} />
          <Route path="team" element={<Team />} />
          <Route path="billing" element={<Billing />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </Suspense>
  );
}

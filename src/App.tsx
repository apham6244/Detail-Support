import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "./components/layout/AppLayout";
import { useAuth } from "./lib/auth";

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

function Splash() {
  return (
    <div className="flex h-screen items-center justify-center bg-ground">
      <Loader2 className="h-6 w-6 animate-spin text-ink3" />
    </div>
  );
}

/** Gate the app shell: splash while loading, redirect to welcome if logged out. */
function RequireAuth() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <Splash />;
  if (!isAuthenticated) return <Navigate to="/welcome" replace />;
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

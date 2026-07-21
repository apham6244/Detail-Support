import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Car,
  CalendarClock,
  FileText,
  UsersRound,
  TrendingUp,
  Sun,
  Moon,
  Eye,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { DetailImage } from "@/components/ui/DetailImage";
import { DSIcon } from "@/components/brand/Logo";
import { PHOTO, unsplash } from "@/lib/imagery";

const features = [
  { icon: Users, label: "Customers" },
  { icon: Car, label: "Vehicles" },
  { icon: CalendarClock, label: "Appointments" },
  { icon: FileText, label: "Invoices" },
  { icon: UsersRound, label: "Teams" },
  { icon: TrendingUp, label: "Growth" },
];

export default function Welcome() {
  const { isAuthenticated, loading } = useAuth();
  const { theme, toggle } = useTheme();

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="relative flex min-h-screen flex-col bg-carbon-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Header — spans both columns */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <DSIcon size={36} />
          <span className="font-display text-[15px] font-bold tracking-tight text-white">Detail Support</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="glass flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:text-white"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <Link
            to="/login"
            className="glass hidden rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-white/[0.16] sm:inline-flex"
          >
            Log in
          </Link>
        </div>
      </header>

      {/* Text panel */}
      <div className="hero-carbon relative order-2 flex items-center px-6 pb-14 pt-10 sm:px-10 lg:order-1 lg:px-16 lg:py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-xl"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/15 px-3 py-1 text-[12.5px] font-semibold text-brand-200">
            For professional auto detailers · Founding-member pricing
          </span>

          <h1 className="font-display mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-[52px]">
            Your detailing business, organized.
          </h1>

          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75 sm:text-base">
            Customers, vehicles, appointments, invoices, teams, growth — and a gear guide built for detailers.
            One premium platform for the whole shop.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-7 text-[15px] font-semibold text-white shadow-glow transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-[1.08] hover:shadow-glow-lg active:scale-[0.98] sm:w-auto"
            >
              Create account
            </Link>
            <Link
              to="/demo"
              className="group glass relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-7 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/20 transition-[transform,background-color,box-shadow] duration-150 hover:bg-white/[0.18] hover:ring-white/30 active:scale-[0.98] sm:w-auto"
            >
              {/* top-edge sheen — the same gloss language as the rest of the app */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent" />
              <Eye className="relative h-[18px] w-[18px]" />
              <span className="relative">Explore Demo</span>
              <ArrowRight className="relative h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl px-7 text-[15px] font-semibold text-white/80 transition hover:text-white sm:w-auto"
            >
              Log in
            </Link>
          </div>

          <p className="mt-3.5 text-[13px] text-white/50">
            Explore the app before creating your account
          </p>

          <div className="mt-10 flex flex-wrap gap-2.5">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-white/80"
              >
                <Icon className="h-3.5 w-3.5 text-brand-300" />
                {label}
              </span>
            ))}
          </div>

          <p className="mt-8 text-[12.5px] text-white/50">14-day free trial · No credit card required</p>
        </motion.div>
      </div>

      {/* Image panel — the car gets its own space so it always reads clearly */}
      <div className="relative order-1 h-56 overflow-hidden bg-carbon-900 sm:h-72 lg:order-2 lg:h-auto lg:min-h-screen">
        <DetailImage
          src={unsplash(PHOTO.ferrariRed, { w: 1400, q: 66 })}
          alt="Freshly detailed luxury sports car with a deep gloss finish"
          className="absolute inset-0"
          eager
        />
        {/* Text lives in its own dark panel, so the image needs only a thin seam
            blend — bottom edge on mobile, left edge on desktop. The car stays
            fully visible. */}
        <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 to-transparent to-40% lg:hidden" />
        <div className="absolute inset-0 hidden lg:block lg:bg-gradient-to-r lg:from-carbon-950 lg:to-transparent lg:to-15%" />
      </div>
    </div>
  );
}

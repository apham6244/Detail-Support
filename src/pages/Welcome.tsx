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
              to="/login"
              className="glass inline-flex h-12 w-full items-center justify-center rounded-xl px-7 text-[15px] font-semibold text-white transition hover:bg-white/[0.16] sm:w-auto"
            >
              Log in
            </Link>
          </div>

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

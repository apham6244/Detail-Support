import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, ArrowRight, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster, ConfirmHost } from "@/components/ui/feedback";
import { EntitlementsProvider } from "@/lib/entitlements";
import { prefetchLikelyRoutes } from "@/lib/prefetch";
import { isDemo, leaveDemo } from "@/lib/demo";

/**
 * Shown only while exploring the demo workspace. Makes it unmistakable that the
 * data is sample data, and gives a one-click path to a real account.
 */
function DemoBanner() {
  if (!isDemo()) return null;
  const leave = (to: string) => leaveDemo(to);

  return (
    <motion.div
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-brand-400/25 bg-gradient-to-r from-brand-600 to-brand-500 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] text-white md:px-[26px] md:pt-2.5"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" />
      <span className="relative flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-white/15">
        <Eye className="h-3.5 w-3.5" />
      </span>
      <span className="relative text-[13px] font-semibold">Demo Mode</span>
      <span className="relative hidden text-[12.5px] text-white/75 sm:inline">
        — data is for preview only, nothing you do here is saved
      </span>
      <div className="relative ml-auto flex items-center gap-2">
        <button
          onClick={() => leave("/signup")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-bold text-brand-600 shadow-sm transition hover:brightness-95 active:scale-95"
        >
          Create your account <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => leave("/welcome")}
          aria-label="Exit demo"
          title="Exit demo"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Warm the routes a signed-in detailer reaches for next, once the shell is idle.
  useEffect(() => { prefetchLikelyRoutes(); }, []);

  // Global ⌘K / Ctrl+K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <EntitlementsProvider>
    <div className="min-h-screen bg-ground md:grid md:grid-cols-[236px_1fr]">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: -260, opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -260, opacity: 0.6 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 shadow-2xl md:hidden"
            >
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-col">
        <DemoBanner />
        <Topbar onMenu={() => setDrawerOpen(true)} onSearch={() => setCmdOpen(true)} />
        {/* Extra bottom padding on mobile clears the fixed bottom nav (+ safe area). */}
        <main className="scrollbar-slim flex-1 overflow-auto px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-[26px] md:pb-12">
          {/* Cap content on ultra-wide displays so a dashboard never runs the full
              width of a 27" monitor; centered, with the gutters absorbing extra space. */}
          <div className="mx-auto w-full max-w-[1560px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation — thumb-reachable primary nav */}
      <BottomNav onMore={() => setDrawerOpen(true)} />

      {/* Global ⌘K command palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* App-wide feedback layer */}
      <Toaster />
      <ConfirmHost />
    </div>
    </EntitlementsProvider>
  );
}

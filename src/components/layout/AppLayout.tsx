import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { EntitlementsProvider } from "@/lib/entitlements";

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        <Topbar onMenu={() => setDrawerOpen(true)} />
        <main className="scrollbar-slim flex-1 overflow-auto px-4 py-6 md:px-[26px] md:pb-12">
          <Outlet />
        </main>
      </div>
    </div>
    </EntitlementsProvider>
  );
}

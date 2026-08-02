import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, RefreshCw, WifiOff, X, Share, Plus } from "lucide-react";
import { DSIcon } from "@/components/brand/Logo";

/**
 * All PWA-lifecycle surfaces, portalled to <body> so no transformed ancestor
 * (e.g. an animate-fade-up page) traps these `fixed` overlays — see the
 * "fixed overlays need portals" note. Three independent, low-frequency banners:
 *
 *  • UpdatePrompt  — a new service worker is waiting; offer a one-tap reload.
 *  • InstallPrompt — capture Android's beforeinstallprompt (or coach iOS Safari)
 *                    and offer a native install, with a "Later" cooldown.
 *  • OfflinePill   — a quiet, honest indicator when the network drops.
 *
 * Mounted once at the app root so it covers public pages (Welcome) and the
 * signed-in shell alike.
 */

/** Sits above the bottom nav (mobile) / bottom-right (desktop), below modals. */
const DOCK =
  "fixed inset-x-0 z-[60] mx-auto w-full max-w-md px-4 " +
  "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] " +
  "md:inset-x-auto md:right-6 md:bottom-6 md:mx-0 md:max-w-sm md:px-0";

const spring = { type: "spring" as const, stiffness: 360, damping: 32 };

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.98 }}
          transition={spring}
          role="status"
          aria-live="polite"
          className={DOCK}
        >
          <div className="surface surface-raised flex items-center gap-3 rounded-2xl p-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-500/12 text-brand-500">
              <RefreshCw className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">Update available</p>
              <p className="truncate text-[12px] text-ink3">A new version of Detail Support is ready.</p>
            </div>
            <button
              onClick={() => updateServiceWorker(true)}
              className="h-9 flex-none rounded-lg bg-brand-500 px-3 text-[13px] font-bold text-white shadow-glow transition active:scale-95"
            >
              Reload
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              aria-label="Dismiss update"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-ink3 transition hover:bg-line2 hover:text-ink active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SNOOZE_KEY = "ds-install-snoozed-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // a week between nudges

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isiOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios|edgios/i.test(navigator.userAgent) // real Safari only (AtHS support)
  );
}

function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed — never nag
    const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (Date.now() < snoozedUntil) return;

    // Android / Chromium: capture the native prompt and reveal our banner.
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const onInstalled = () => {
      setOpen(false);
      setDeferred(null);
      localStorage.removeItem(SNOOZE_KEY);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt — coach the manual flow instead.
    let iosTimer: number | undefined;
    if (isiOS()) {
      iosTimer = window.setTimeout(() => {
        setIosHint(true);
        setOpen(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setOpen(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice; // outcome either way: stop showing this session
    setDeferred(null);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 28, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 28, opacity: 0, scale: 0.98 }}
          transition={spring}
          role="dialog"
          aria-label="Install Detail Support"
          className={DOCK}
        >
          <div className="surface surface-raised overflow-hidden rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <DSIcon size={48} className="shadow-card" />

              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-ink">Install Detail Support</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink3">
                  {iosHint
                    ? "Add it to your Home Screen for a full-screen, app-like experience."
                    : "Get one-tap access and a full-screen, app-like experience — right from your Home Screen."}
                </p>
              </div>
              <button
                onClick={snooze}
                aria-label="Not now"
                className="-mr-1 -mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink3 transition hover:bg-line2 hover:text-ink active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {iosHint ? (
              <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-panel2 py-2.5 text-[12.5px] font-medium text-ink2">
                Tap <Share className="h-4 w-4 text-brand-500" /> then
                <span className="inline-flex items-center gap-1 font-semibold text-ink">
                  <Plus className="h-3.5 w-3.5" /> Add to Home Screen
                </span>
              </p>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={snooze}
                  className="h-10 flex-1 rounded-xl border border-line bg-panel text-[13.5px] font-semibold text-ink2 transition hover:bg-line2 active:scale-[0.98]"
                >
                  Later
                </button>
                <button
                  onClick={install}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 text-[13.5px] font-bold text-white shadow-glow transition hover:shadow-glow-lg active:scale-[0.98]"
                >
                  <Download className="h-4 w-4" /> Install
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OfflinePill() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-danger/25 bg-danger/12 px-3.5 py-1.5 text-[12.5px] font-semibold text-danger shadow-card backdrop-blur">
            <WifiOff className="h-3.5 w-3.5" /> You're offline — changes may not save
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PwaPrompts() {
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <OfflinePill />
      <UpdatePrompt />
      <InstallPrompt />
    </>,
    document.body
  );
}

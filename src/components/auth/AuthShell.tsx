import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { DetailImage } from "@/components/ui/DetailImage";
import { PHOTO, unsplash } from "@/lib/imagery";
import { cn } from "@/lib/cn";

/**
 * Premium detailing-themed shell for the pre-auth pages (Login / Sign Up).
 * A dark, glossy garage backdrop with soft brand lighting and drifting water
 * beads, plus a frosted-glass card — a consistent brand moment regardless of
 * the app's light/dark theme. Styling primitives (`.auth-card`, `.auth-input`,
 * `.auth-btn`…) are injected once here and shared by both pages.
 */

// Drifting "water beads" — subtle, slow, never distracting.
const BEADS = [
  { top: "16%", left: "10%", size: 12, dur: 8, delay: 0, o: 0.5 },
  { top: "28%", left: "82%", size: 8, dur: 10, delay: 1.2, o: 0.4 },
  { top: "62%", left: "16%", size: 9, dur: 9, delay: 0.6, o: 0.45 },
  { top: "74%", left: "78%", size: 14, dur: 11, delay: 2, o: 0.4 },
  { top: "44%", left: "50%", size: 6, dur: 7, delay: 0.3, o: 0.35 },
  { top: "12%", left: "60%", size: 7, dur: 12, delay: 1.8, o: 0.4 },
  { top: "86%", left: "42%", size: 10, dur: 10, delay: 0.9, o: 0.35 },
  { top: "52%", left: "90%", size: 6, dur: 9, delay: 1.5, o: 0.3 },
  { top: "34%", left: "30%", size: 8, dur: 13, delay: 2.4, o: 0.35 },
];

function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <DetailImage src={unsplash(PHOTO.glossyBlack, { w: 2000, q: 62 })} alt="" className="absolute inset-0" eager />
      {/* Readability + depth gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-carbon-950/75 via-carbon-950/88 to-carbon-950" />
      <div className="absolute inset-0 bg-gradient-to-tr from-carbon-950 via-carbon-950/40 to-transparent" />
      <div className="absolute inset-0 bg-paint-gloss opacity-30" />
      {/* Garage light sheen along the top */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/[0.07] to-transparent" />
      {/* Soft animated brand lighting */}
      <motion.div
        className="absolute -left-24 top-[-12%] h-[48vh] w-[48vh] rounded-full bg-brand-500/25 blur-[130px]"
        animate={{ y: [0, 34, 0], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-28 bottom-[-14%] h-[44vh] w-[44vh] rounded-full bg-violet/20 blur-[140px]"
        animate={{ y: [0, -28, 0], opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Water beads */}
      {BEADS.map((b, i) => (
        <span
          key={i}
          className="auth-bead"
          style={{ top: b.top, left: b.left, width: b.size, height: b.size, opacity: b.o, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
        />
      ))}
      {/* Vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_180px_50px_rgba(0,0,0,0.55)]" />
    </div>
  );
}

export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-carbon-950 text-white">
      <Backdrop />
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={cn("w-full", wide ? "max-w-xl" : "max-w-[410px]")}
        >
          {children}
        </motion.div>
      </div>
      <AuthStyles />
    </div>
  );
}

export function AuthField({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="auth-label">{label}</span>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40 [&>svg]:h-[17px] [&>svg]:w-[17px]">
            {icon}
          </span>
        )}
        {children}
      </div>
    </label>
  );
}

function AuthStyles() {
  return (
    <style>{`
      .auth-card {
        background: linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.028));
        backdrop-filter: blur(22px) saturate(125%);
        -webkit-backdrop-filter: blur(22px) saturate(125%);
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 26px 70px -24px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,255,255,0.09);
      }
      .auth-label {
        display:block; margin-bottom:6px; font-size:11px; font-weight:600;
        text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.55);
      }
      .auth-input {
        height:44px; width:100%; border-radius:12px;
        background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12);
        color:#fff; padding:0 14px; font-size:14px; font-family:inherit;
        transition:border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
      }
      .auth-input.has-icon { padding-left:40px; }
      .auth-input::placeholder { color:rgba(255,255,255,0.38); }
      .auth-input:hover:not(:focus) { border-color:rgba(255,255,255,0.20); }
      .auth-input:focus { outline:none; border-color:#6AA0FF; background:rgba(255,255,255,0.075); box-shadow:0 0 0 4px rgba(46,123,255,0.20); }
      .auth-input:-webkit-autofill { -webkit-text-fill-color:#fff; transition: background-color 9999s ease-in-out 0s; }
      .auth-btn {
        position:relative; height:46px; width:100%; border-radius:12px; overflow:hidden;
        font-weight:600; font-size:14px; color:#fff;
        background:linear-gradient(180deg,#3B86FF,#1F63E6);
        box-shadow:0 8px 24px -8px rgba(46,123,255,0.65), inset 0 1px 0 rgba(255,255,255,0.28);
        transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
      }
      .auth-btn:hover:not(:disabled) { filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 14px 32px -8px rgba(46,123,255,0.8), inset 0 1px 0 rgba(255,255,255,0.32); }
      .auth-btn:active:not(:disabled) { transform:translateY(0) scale(0.99); }
      .auth-btn:disabled { opacity:0.5; cursor:not-allowed; }
      .auth-btn-ghost {
        height:46px; border-radius:12px; font-weight:600; font-size:13.5px; color:rgba(255,255,255,0.78);
        background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12);
        transition:background-color .15s ease, border-color .15s ease, color .15s ease;
      }
      .auth-btn-ghost:hover { background:rgba(255,255,255,0.09); border-color:rgba(255,255,255,0.22); color:#fff; }
      .auth-bead {
        position:absolute; border-radius:9999px;
        background:radial-gradient(circle at 32% 30%, rgba(255,255,255,0.65), rgba(160,195,255,0.16) 55%, transparent 72%);
        box-shadow:0 0 10px rgba(120,170,255,0.30);
        animation-name:authFloat; animation-timing-function:ease-in-out; animation-iteration-count:infinite; will-change:transform;
      }
      @keyframes authFloat { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-16px) } }
      @media (prefers-reduced-motion: reduce) {
        .auth-bead { animation:none !important; }
      }
    `}</style>
  );
}

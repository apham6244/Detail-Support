/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Electric-blue brand scale (stable across themes)
        brand: {
          50: "#EAF2FF",
          100: "#D6E4FF",
          200: "#ADC8FF",
          300: "#84ABFF",
          400: "#5B8EFF",
          500: "#2E7BFF",
          600: "#1E63E0",
          700: "#164FB8",
          800: "#123F93",
          900: "#0E2F6E",
        },
        // Theme-aware tokens (defined as R G B triplets in index.css)
        ground: "rgb(var(--ground) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        panel2: "rgb(var(--panel-2) / <alpha-value>)",
        sidebar: "rgb(var(--sidebar) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        ink2: "rgb(var(--ink-2) / <alpha-value>)",
        ink3: "rgb(var(--ink-3) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        line2: "rgb(var(--line-2) / <alpha-value>)",
        // Semantic (stable)
        success: "#17A867",
        warning: "#E08A00",
        danger: "#E1483C",
        violet: "#7A5BE0",
        // Obsidian "carbon" scale for premium dark automotive sections (heroes,
        // marketing, auth). Stable across light/dark — these surfaces stay dark.
        carbon: {
          950: "#070A11",
          900: "#0B0F17",
          800: "#111725",
          700: "#1A2234",
          600: "#232D42",
          500: "#2F3B54",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Segoe UI",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: ["Sora", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(16 22 38 / 0.04), 0 4px 16px rgb(16 22 38 / 0.05)",
        "card-dark": "0 1px 2px rgb(0 0 0 / 0.3), 0 6px 20px rgb(0 0 0 / 0.35)",
        // Primary-button glow: a soft brand bloom + a 1px inner top highlight so
        // the surface catches light (glossy, not flat). Shared by the Button and
        // every gradient CTA link that uses `shadow-glow`.
        glow: "0 2px 6px -1px rgb(46 123 255 / 0.32), 0 6px 18px -3px rgb(46 123 255 / 0.42), inset 0 1px 0 rgb(255 255 255 / 0.22)",
        // Hover state — the bloom grows and lifts.
        "glow-lg": "0 3px 8px -1px rgb(46 123 255 / 0.40), 0 12px 28px -4px rgb(46 123 255 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.3)",
        // Deep, soft lift for hovered premium cards — a wide, feathered shadow
        // plus a faint brand-tinted bloom so lifts feel lit, not just dropped.
        lift: "0 2px 6px rgb(16 22 38 / 0.06), 0 22px 48px -14px rgb(16 22 38 / 0.20), 0 8px 24px -12px rgb(46 123 255 / 0.10)",
        "hero-dark": "0 30px 80px -20px rgb(0 0 0 / 0.6)",
      },
      backgroundImage: {
        // A subtle "polished paint" sheen for dark carbon surfaces.
        "paint-gloss":
          "radial-gradient(120% 120% at 15% 0%, rgb(46 123 255 / 0.22) 0%, transparent 45%), radial-gradient(120% 120% at 100% 100%, rgb(122 91 224 / 0.18) 0%, transparent 50%)",
        carbon:
          "linear-gradient(135deg, #0B0F17 0%, #141b29 50%, #0B0F17 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        sheen: {
          "0%": { transform: "translateX(-120%) skewX(-18deg)" },
          "100%": { transform: "translateX(220%) skewX(-18deg)" },
        },
      },
      animation: {
        // Fast, premium ease-out (easeOutQuint) — motion resolves early so it
        // reads snappy, not floaty.
        "fade-up": "fade-up 0.34s cubic-bezier(0.22, 1, 0.36, 1) both",
        fade: "fade 0.25s ease both",
        shimmer: "shimmer 1.5s infinite",
        sheen: "sheen 1.1s ease",
      },
    },
  },
  plugins: [],
};

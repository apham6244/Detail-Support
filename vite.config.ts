import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A new service worker is published on every deploy; we surface a subtle
      // "update ready" prompt (see PwaPrompts) rather than reloading under the
      // user mid-task. `prompt` keeps the waiting SW parked until they accept.
      registerType: "prompt",
      injectRegister: null, // we register manually via virtual:pwa-register/react
      includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png", "offline.html"],
      manifest: {
        name: "Detail Support — Auto Detailer CRM",
        short_name: "Detail Support",
        description:
          "The all-in-one business platform built for professional auto detailers — customers, appointments, invoices, and growth in one app.",
        id: "/",
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0f17",
        theme_color: "#0b0f17",
        categories: ["business", "productivity"],
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the built app shell so it launches instantly and works offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        // SPA: any uncached navigation resolves to the cached shell…
        navigateFallback: "/index.html",
        // …except API traffic, which must hit the network (never serve the shell
        // for a data call that failed offline).
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Google Fonts stylesheet — revalidate in the background.
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            // Google Fonts webfont files — immutable, cache hard for a year.
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Remote imagery (Unsplash automotive photography) — serve fast from
            // cache, refresh in the background, cap the cache size.
            urlPattern: ({ request, url }) =>
              request.destination === "image" && url.origin !== self.location.origin,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "remote-images",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW off in `vite dev` (avoids stale-cache confusion while
        // iterating); it's exercised via `vite build` + `vite preview`.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the large, stable vendors out of the app entry so (a) the entry
        // chunk is smaller on first paint and (b) these rarely-changing bundles
        // stay cached across deploys. Recharts is already lazy per-page, so it's
        // intentionally left to its own dynamic chunk.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});

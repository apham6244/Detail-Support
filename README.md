# Amei Auto Detailz — Outreach CRM (Frontend)

A professional SaaS-style outreach CRM for finding, organizing, and contacting
automotive businesses around Dallas, Garland, Sachse, and Plano, TX.

Built with **React + TypeScript + Vite + Tailwind CSS**, with React Router,
Recharts, Framer Motion, and lucide-react.

## Prerequisites

- **Node.js 18+** — install the LTS from https://nodejs.org (this machine does
  not currently have Node installed). After installing, close and reopen your
  terminal so `node` is on your PATH.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server at http://localhost:5173
```

Then open http://localhost:5173. Use the theme toggle (sun/moon, top-right) to
switch light/dark.

Other scripts:

```bash
npm run build    # type-check + production build to /dist
npm run preview  # preview the production build locally
```

## Project structure

```
src/
  main.tsx              App entry — Router + ThemeProvider
  App.tsx               Routes (all pages nested in AppLayout)
  index.css             Tailwind layers + theme CSS variables
  lib/
    cn.ts               className join helper
    theme.tsx           light/dark ThemeProvider + useTheme
  data/
    mock.ts             sample data (mirrors the Supabase schema)
  components/
    layout/             Sidebar, Topbar, AppLayout (the app shell)
    ui/                 Card, Button, Badge, StatCard, Sparkline, PageHeader
  pages/
    Dashboard.tsx  Contacts.tsx  Campaigns.tsx
    Templates.tsx  Analytics.tsx Settings.tsx
```

## Notes

- This is the **frontend only**, running on mock data in `src/data/mock.ts`.
  When the backend is added, swap those imports for Supabase queries — component
  props stay the same.
- Design tokens (electric-blue brand scale + theme-aware surfaces) live in
  `tailwind.config.js` and `src/index.css`.

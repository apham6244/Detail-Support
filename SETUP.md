# Amei Auto Detailz — Full-Stack Setup (≈ 10 minutes)

This connects the three pieces — **Supabase** (database + auth), the **backend API**,
and the **frontend** — into a working app.

> I can't create the Supabase project for you (it's your account and your
> credentials), so steps 1–3 are yours. Everything else is already wired.

---

## 1. Create a Supabase project

1. Go to **https://supabase.com** → sign in → **New project**.
2. Name it `amei-outreach`, pick a region near Texas (e.g. `us-east-1`), set a
   database password (save it somewhere).
3. Wait ~2 minutes for it to provision.

## 2. Run the database schema

In the Supabase dashboard: **SQL Editor** → **New query**. Paste and **Run** each
of these files **in order** (contents are in `server/db/`):

1. `server/db/schema.sql` — tables, indexes, row-level security, analytics view
2. `server/db/002_lead_activities.sql` — communication-history timeline + triggers
3. `server/db/003_ai_scoring.sql` — AI score columns + activity types

Each should report success. (Run them one at a time.)

## 3. Get your API keys

**Project Settings → API.** Copy three values:

- **Project URL** (e.g. `https://abcd.supabase.co`)
- **anon public** key
- **service_role** key (keep this secret — server only)

## 4. Configure the backend

In `server/`:

```bash
cp .env.example .env
```

Edit `server/.env` and fill in:

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
# Optional — enables AI scoring / reply analysis:
ANTHROPIC_API_KEY=<key from console.anthropic.com>
```

Start it:

```bash
cd server
npm install
npm run dev        # http://localhost:4000
```

Check: open http://localhost:4000/api/health → `{"status":"ok",...}`.

## 5. Configure & start the frontend

The frontend already points at the backend via `.env` (`VITE_API_URL=http://localhost:4000/api`).
From the project root:

```bash
npm install
npm run dev        # http://localhost:5173
```

## 6. Create your account + load sample data

1. Open **http://localhost:5173** → click the **login icon** (top-right) → **Create account**.
2. Sign up with your email + a password. (Supabase may email a confirmation link —
   click it, or disable "Confirm email" under **Authentication → Providers → Email**
   for local testing.)
3. Log in. The top-right chip flips from **Demo** to **Live**.
4. Go to **Contacts → Import CSV** and upload `server/db/sample-leads.csv` to get
   the sample dealerships loaded.
5. Click **Score** on a lead (if you set `ANTHROPIC_API_KEY`) to see AI lead scoring.

---

## How it fits together

```
Browser (React :5173)
   │  login → Bearer token
   ▼
Backend API (Express :4000)
   │  user-scoped Supabase client (RLS enforced)
   ▼
Supabase (Postgres + Auth)
```

- **Demo mode:** until you log in, the frontend shows mock data so nothing looks
  broken. Once logged in, every page reads/writes your real Supabase data.
- **AI is optional:** without `ANTHROPIC_API_KEY` the app works fully; scoring
  buttons just report that AI is disabled.

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

1. `schema.sql` — tables, indexes, row-level security, analytics view
2. `002_lead_activities.sql` — communication-history timeline + triggers
3. `003_ai_scoring.sql` — AI lead scoring + reply-analysis columns
4. `010_tenancy.sql` — multi-tenancy foundation (orgs + memberships)
5. `011_operations.sql` — operational core (customers, vehicles, services, appointments)
6. `012_invoices.sql` — invoices + line items (track / mark-paid)
7. `013_team.sql` — team roles, invitations & RBAC
8. `014_subscriptions.sql` — subscriptions, payments, audit log + plan limits
9. `015_subscription_plans.sql` — plan catalog + feature entitlements
10. `016_quotes.sql` — quotes + line items + conversion RPCs
11. `017_job_assignments.sql` — job assignments & team scheduling
12. `018_marketing.sql` — marketing campaigns
13. `019_drop_legacy_crm.sql` — remove the legacy outreach-CRM schema
14. `020_customer_photos.sql` — job photos
15. `021_reminders.sql` — appointment reminders
16. `022_send_queue.sql` — reminder scheduling + campaign send results
17. `023_reminder_claim.sql` — reminder claim + recovery (**run after 022**)
18. `024_stripe.sql` — Stripe billing wiring
19. `025_fix_owner_guard.sql` — security fix: owner-guard RLS
20. `026_leads.sql` — leads (lightweight pre-customer CRM)
21. `027_customer_referral.sql` — customer "how did you hear about us?" field
22. `028_quote_internal_notes.sql` — private staff-only note on quotes
23. `029_invoice_vehicle_internal_notes.sql` — vehicle + staff-only note on invoices

Each should report success. (Run them one at a time.)

> **Already have a database from an earlier setup?** You only need to run the
> files numbered higher than your last-applied migration. Every `0xx_` migration
> is additive and idempotent (uses `add column if not exists`, etc.), so it's
> safe to re-run one you're unsure about. The newest are **`028`** and **`029`** —
> without them, quote/invoice internal notes and the invoice's vehicle field
> simply no-op (the app is written to degrade gracefully until they're applied).

### Prefer a script? (`npm run db:migrate`)

Instead of pasting each file by hand, you can apply migrations with the built-in
runner. It tracks what's been applied in a `schema_migrations` table and runs
only what's pending, each in its own transaction.

1. Add a direct Postgres connection string to `server/.env` as `DATABASE_URL`
   (Supabase → **Settings → Database → Connection string → URI**; pick **Direct
   connection** or **Session pooler**, not Transaction pooler). See `.env.example`.
2. From `server/`:

   ```bash
   npm run db:migrate:status     # see what's applied vs pending
   npm run db:migrate            # apply everything pending, in order
   ```

If your database was set up **by hand** before adopting the runner, first record
what you've already run so it isn't executed again (this only writes tracking
rows — it does not run those files), then migrate the rest:

```bash
# mark schema.sql … 027 as already applied, then apply 028, 029, …
node scripts/migrate.mjs --baseline 027_customer_referral.sql
npm run db:migrate
```

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

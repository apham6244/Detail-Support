# Amei Auto Detailz — Production Readiness

Everything needed to take this from "runs locally" to "live and safe."

> **Honest readiness snapshot.** The app **type-checks, builds, and boots**, and
> the deploy configs here are real. Two gaps stand between this and "production
> ready" in the full sense, and no config file closes them:
> 1. **No automated tests exist yet** — the testing plan below is the work to do,
>    not work already done.
> 2. **It has never run end-to-end against a live database** (Supabase isn't
>    connected yet). A real smoke test is step 0 of going live.
> Treat this document as the runway, and those two items as the required takeoff.

---

## 1. Testing plan

Three layers, cheapest-and-most-numerous first.

### Backend (highest priority — it holds the data + auth)
- **Tool:** [Vitest](https://vitest.dev) + [supertest](https://github.com/ladjs/supertest) (HTTP-level tests against the Express app).
- **Unit** — pure logic with no network: `email/render.ts` (variable substitution, HTML escaping — you already saw this proven), `utils/csv.ts` (header mapping, category synonyms, row validation), zod schemas (accept valid / reject invalid).
- **Integration** — spin up the app with `createApp()` and hit routes with supertest against a **dedicated Supabase test project** (never prod):
  - Auth: register → login → `me` returns the profile; bad token → 401.
  - **RLS isolation (critical):** user A cannot read/update/delete user B's leads even with a valid token. This is the single most important test in the suite.
  - Leads CRUD + filters + pagination; CSV import dedupe + summary; campaign create → add recipients → send (console provider) → stats.
  - Validation: malformed bodies → 400 with field details; unknown route → 404.
- **Contract for AI/email** — mock the Anthropic and SendGrid clients; assert the request shape and that a bad key surfaces a clean 5xx, not a crash.

### Frontend
- **Tool:** Vitest + React Testing Library; **Playwright** for end-to-end.
- **Component/hook** — `useLeads` returns demo data when logged out and maps API shape when logged in; `Contacts` renders the demo banner + Score buttons; the score button is disabled in demo mode.
- **E2E (Playwright)** — the real user journeys against a running stack: sign in → Contacts shows live data; Import CSV → rows appear; click Score → tier chip appears; log out → back to demo. Theme toggle persists.

### CI (GitHub Actions)
On every PR: install → `npm run build` (frontend) and `npm run build` + `npm test` (backend) → block merge on failure. Add a nightly Playwright run against a staging deploy.

**Definition of done for v1:** RLS isolation test passing, the render + CSV unit tests passing, and one green end-to-end "sign in → import → score" Playwright run.

---

## 2. Security checklist

Much of this is already built — ✅ = in place, ☐ = do before/at launch.

**Secrets**
- ✅ All secrets in env vars, validated at boot (`config/env.ts`); `.env` gitignored.
- ☐ `SUPABASE_SERVICE_ROLE_KEY` lives **only** on the backend host (Render), never in the frontend or the repo. It bypasses RLS — treat it like a root password.
- ☐ Rotate any key that ever touched a screenshot, log, or chat.

**Auth & data isolation**
- ✅ Supabase JWT verified on every protected route (`middleware/auth.ts`).
- ✅ **Row-Level Security** on every table — the real isolation boundary; per-request client is JWT-scoped.
- ☐ Add the RLS isolation test (section 1) — verify, don't assume.
- ☐ In Supabase Auth: enable email confirmation for production, set a strong password policy, and set the Site URL to your Vercel domain.

**Transport & headers**
- ✅ `helmet` security headers; ✅ `express.json` body-size limit (1 MB); ✅ `trust proxy` for correct client IPs behind the host.
- ✅ **CORS allow-list from `CORS_ORIGINS`** — set it to your exact Vercel URL(s) in prod (no `*`).
- ☐ HTTPS everywhere (Vercel + Render provide it automatically; don't serve the API over http).

**Abuse & input**
- ✅ Rate limiting — strict on `/auth`, general on the API.
- ✅ zod validation on every body/query/param; ✅ Postgres access is parameterized (Supabase client) → no SQL injection.
- ✅ Webhook signature verification (SendGrid) when the key is set — **set it in prod**.

**Compliance & PII**
- ✅ CAN-SPAM footer + unsubscribe on every send; ✅ suppression list enforced before sending.
- ☐ Verify your sending domain (SPF/DKIM/DMARC) before real outreach — otherwise mail lands in spam and you risk blacklisting.

**Dependencies**
- ☐ `npm audit` in CI; enable Dependabot; patch high/critical before deploy.

---

## 3. Deployment steps

Order matters: **database → backend → frontend** (each needs the previous one's URL).

### A. Supabase (database) — production project
1. Create a **separate** Supabase project for production (keep dev/staging apart).
2. SQL Editor → run in order: `server/db/schema.sql` → `002_lead_activities.sql` → `003_ai_scoring.sql`.
3. **Authentication → URL Configuration:** set Site URL to your Vercel domain; add it to redirect allow-list.
4. Copy the Project URL + anon + service_role keys for the next step.

### B. Backend (Node) — Render (or Railway/Fly)
Two supported paths, both in `server/`:
- **Blueprint:** `render.yaml` — New → Blueprint → pick the repo → fill the `sync:false` secrets in the dashboard.
- **Docker:** the `Dockerfile` builds a slim, non-root image that runs anywhere (Railway, Fly, Cloud Run).

Set env vars (from `.env.example`): `NODE_ENV=production`, the three `SUPABASE_*` keys, `CORS_ORIGINS=https://your-app.vercel.app`, `APP_URL=https://your-app.vercel.app`, and (optional) `ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`, `EMAIL_PROVIDER=sendgrid`. Health check path is `/api/health`.

Deploy → confirm `https://your-api.onrender.com/api/health` returns ok.

### C. Frontend (Vercel)
1. Import the repo in Vercel (root directory = repo root; framework auto-detected as Vite via `vercel.json`).
2. Env var: `VITE_API_URL=https://your-api.onrender.com/api`.
3. Deploy. `vercel.json` rewrites keep client-side routes working on refresh.

### D. Wire the loop
- Set the backend's `CORS_ORIGINS` + `APP_URL` to the **final** Vercel URL, redeploy the backend.
- (Email) Point SendGrid's Event Webhook at `https://your-api.onrender.com/api/webhooks/sendgrid` and Inbound Parse at `/api/webhooks/inbound`.

### E. Smoke test in prod
Sign up → import `sample-leads.csv` → send a test email → score a lead. If all four work, you're live.

---

## 4. Database backup strategy

Your data lives in Supabase (managed Postgres), so lean on its tooling plus one habit of your own.

- **Automated backups (Supabase):** daily backups are included; enable **Point-in-Time Recovery (PITR)** on a paid tier for the lead/outreach data — it lets you restore to any second, which matters once you have real customer relationships recorded.
- **Schema as code:** your schema *is* version-controlled (`server/db/*.sql`) — that's half of disaster recovery. Keep every change as a new numbered migration file; never edit the DB by hand in prod.
- **Your own weekly dump (belt & suspenders):** a scheduled `pg_dump` of the connection string to off-Supabase storage (e.g. an S3 bucket), so a Supabase-account problem can't take your only copy:
  ```
  pg_dump "$SUPABASE_DB_URL" -Fc -f amei-$(date +%F).dump
  ```
- **Restore drill:** once, restore a backup into a scratch project and confirm the app runs against it. An untested backup is a guess, not a backup.
- **Retention:** keep 30 daily + 12 monthly dumps; encrypt them at rest.

---

## 5. Performance optimization

Most of the groundwork is already in the code; the rest is standard scaling hygiene.

**Database (already strong)**
- ✅ Indexes on every hot path — `leads(owner_id, status)`, `leads(owner_id, ai_score desc)`, `campaign_recipients(campaign_id)`, `email_events(sent_email_id)`, GIN on `tags`, partial index on pending follow-ups.
- ✅ Server-side pagination + filtering on every list endpoint (never "fetch all").
- ☐ Use the **Supabase connection pooler** (pgBouncer, port 6543) for the backend's DB URL so many API instances don't exhaust connections.

**Backend**
- ✅ `compression` (gzip) on responses; ✅ rate limits cap runaway cost.
- ✅ AI scoring is designed for the **Batch API** (bulk, 50% cheaper) and uses cheap Haiku for classification; email sends are throttled.
- ☐ At scale, move campaign sending from the in-process loop to a durable queue (**BullMQ + Redis**) and run the scheduler as the trigger only — noted in the code.
- ☐ Add structured logging (pino) + an error tracker (Sentry) so you can see slow routes and failures in prod.

**Frontend**
- ✅ Vite production build (minified, tree-shaken, hashed assets); Vercel serves them over a CDN with long cache headers automatically.
- ☐ **Code-split routes** with `React.lazy` + `Suspense` so the initial load doesn't ship Recharts/Framer for every page — biggest single win for first paint.
- ☐ TanStack Query for request caching/dedup once more pages are wired to live data.
- ✅ Charts and animations respect `prefers-reduced-motion`.

---

## Go-live checklist (the short version)

- [ ] Prod Supabase project created + all 3 SQL files run
- [ ] RLS isolation test written and passing
- [ ] Backend deployed (Render/Docker), `/api/health` green, secrets set
- [ ] `CORS_ORIGINS` + `APP_URL` = the real Vercel URL
- [ ] Frontend deployed with `VITE_API_URL` pointing at the API
- [ ] Sending domain verified (SPF/DKIM/DMARC) + SendGrid webhooks wired
- [ ] Email confirmation + password policy enabled in Supabase Auth
- [ ] PITR/backups on; one restore drill done
- [ ] `npm audit` clean; Sentry + logging on
- [ ] Prod smoke test passed: sign up → import → send → score

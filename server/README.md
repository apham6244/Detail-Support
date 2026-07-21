# Amei Auto Detailz — Outreach CRM API

Express + TypeScript backend backed by **Supabase (PostgreSQL + Auth)**.

## Architecture

```
src/
  index.ts              start the HTTP server (graceful shutdown)
  app.ts                express app: security middleware → routes → errors
  config/
    env.ts              validates env vars at boot (zod)
    supabase.ts         anon / admin / per-request user-scoped clients
  middleware/
    auth.ts             requireAuth (JWT → req.user + RLS-scoped req.supabase)
    validate.ts         zod request validation
    rateLimiter.ts      auth + general rate limits
    errorHandler.ts     single JSON error shape
    notFound.ts         404
  schemas/              zod schemas per resource
  services/             business logic + Supabase queries (RLS enforced)
  controllers/          thin request handlers
  routes/               endpoint → controller wiring
  db/schema.sql         full database schema, indexes, RLS, analytics view
```

**Security model:** every authenticated request builds a Supabase client from
the caller's JWT, so **Postgres Row-Level Security is the isolation boundary** —
a user can only read/write rows where `owner_id = auth.uid()`. The
`service_role` key is used only to verify tokens, never for data queries.

## Setup

1. Create a Supabase project → **SQL Editor** → paste and run `db/schema.sql`.
2. Copy env and fill in values from **Project Settings → API**:
   ```bash
   cp .env.example .env
   ```
3. Install and run:
   ```bash
   npm install
   npm run dev          # http://localhost:4000
   ```

## API

All data routes require `Authorization: Bearer <access_token>`.

| Method | Path | Description |
|---|---|---|
| GET  | `/api/health` | Liveness check |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in → returns session |
| POST | `/api/auth/refresh` | Exchange refresh token |
| POST | `/api/auth/logout` | Revoke session |
| GET  | `/api/users/me` | Current user + profile |
| PATCH| `/api/users/me` | Update profile |
| GET/POST | `/api/contacts` | List / create contacts |
| GET/PATCH/DELETE | `/api/contacts/:id` | Read / update / delete |
| GET  | `/api/leads/status-counts` | Counts by status (dashboard) |
| GET  | `/api/leads/categories` | Lead counts per category |
| GET/POST | `/api/leads` | List (filter: status, category, tag, search) / create |
| POST | `/api/leads/manual` | Add a lead: business + contact in one step |
| POST | `/api/leads/import` | CSV upload (field `file`) or `{ rows: [...] }` |
| GET/PATCH/DELETE | `/api/leads/:id` | Read / update / delete |
| GET  | `/api/leads/:id/activities` | Communication history timeline |
| POST | `/api/leads/:id/notes` | Add a note |
| POST | `/api/leads/:id/activities` | Log a call / meeting / manual email |
| POST | `/api/leads/:id/tags` | Add a tag |
| DELETE | `/api/leads/:id/tags/:tag` | Remove a tag |

> Run `db/002_lead_activities.sql` after `db/schema.sql` — it adds the
> `lead_activities` timeline and the triggers that auto-log status changes,
> sends, opens, and replies.
| GET/POST | `/api/campaigns` | List / create |
| GET/PATCH/DELETE | `/api/campaigns/:id` | Read / update / delete |
| POST | `/api/campaigns/:id/recipients` | Attach leads |
| GET  | `/api/campaigns/:id/recipients` | List recipients |
| GET  | `/api/campaigns/:id/stats` | Open/click/reply aggregates |
| POST | `/api/campaigns/:id/send` | Send now (`{ followUpDays? }`) |
| GET/POST | `/api/templates` | List / create templates |
| GET/PATCH/DELETE | `/api/templates/:id` | Read / update / delete |
| POST | `/api/email/test` | Send a preview email |
| GET/POST | `/api/follow-ups` | List / create follow-ups |
| PATCH/DELETE | `/api/follow-ups/:id` | Update (mark done) / delete |
| POST | `/api/webhooks/sendgrid` | Event webhook (delivery/open/click/bounce) — no auth |
| POST | `/api/webhooks/inbound` | Inbound Parse (replies) — no auth |
| GET  | `/api/ai/status` | Whether AI features are enabled |
| POST | `/api/ai/leads/:id/score` | AI lead score (0–100, tier, reasons) |
| POST | `/api/ai/analyze-reply` | Classify a reply (`{ text, leadId?, subject? }`) |

## AI features (phase 1)

Set `ANTHROPIC_API_KEY` in `.env` to enable. Uses the Anthropic SDK with
**Claude Haiku 4.5** and structured outputs (guaranteed-valid JSON).

- **Lead scoring** (`src/services/ai/scoring.service.ts`) — scores a lead by
  category, proximity, contactability, and engagement (opens/replies). Writes
  `leads.ai_score` / `ai_tier` / `ai_reasons` and a timeline entry. Run
  `db/003_ai_scoring.sql` first (adds the columns + activity types).
- **Reply analysis** (`src/services/ai/replyAnalysis.service.ts`) — classifies
  inbound replies (sentiment, intent, suggested status). Runs automatically in
  the Inbound Parse webhook (fire-and-forget) and auto-suppresses opt-outs.

Both are advisory and logged; nothing is auto-sent. Run migration
`db/003_ai_scoring.sql` after `002_lead_activities.sql`.

## Email automation

- **Providers** live behind `src/email/EmailProvider.ts`. `EMAIL_PROVIDER=console`
  (default) logs emails so everything runs with no account; `sendgrid` sends for
  real with open/click tracking enabled.
- **Personalization** (`src/email/render.ts`) supports bracket variables:
  `[Business Name]`, `[Contact Name]`, `[First Name]`, `[City]`, `[My Name]`,
  `[My Business]`. Values are HTML-escaped; a CAN-SPAM footer + unsubscribe link
  is appended automatically.
- **Sending** (`src/services/send.service.ts`) skips leads with no email or on the
  suppression list, writes a `sent_emails` row per send (its id rides along as a
  SendGrid `custom_arg`), and can auto-create a follow-up N days later.
- **Tracking**: SendGrid's event webhook → `email_events`; bounces/opt-outs are
  added to `suppressions`. Replies arrive via Inbound Parse → `replied` event and
  the lead is advanced to `interested`.
- **Scheduling**: `src/jobs/scheduler.ts` (node-cron) dispatches campaigns whose
  `scheduled_at` has passed, every minute.

### SendGrid setup (to go live)

1. Create a SendGrid account, verify your sending domain (SPF/DKIM).
2. Set `EMAIL_PROVIDER=sendgrid` and `SENDGRID_API_KEY` in `.env`.
3. Event Webhook → point to `https://YOUR_API/api/webhooks/sendgrid`, enable
   signature verification, and paste the key into `SENDGRID_WEBHOOK_VERIFICATION_KEY`.
4. Inbound Parse → point an MX subdomain to `https://YOUR_API/api/webhooks/inbound`
   to capture replies.

> For high volume, move sending from the in-process loop to a durable queue
> (BullMQ + Redis) and keep the scheduler only as the trigger.

### Response shapes

- List: `{ data: [...], page, limit, total }`
- Single: `{ data: {...} }`
- Error: `{ error: string, details?: [...] }`

## Scripts

```bash
npm run dev         # watch mode (tsx)
npm run typecheck   # tsc --noEmit
npm run build       # compile to /dist
npm start           # run compiled server
```

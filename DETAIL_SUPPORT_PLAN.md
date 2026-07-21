# Amei Outreach CRM → Detail Support (SaaS) — Migration Plan

A plan to evolve the existing single-user outreach CRM into **Detail Support**, a
multi-tenant SaaS for auto detailers. **No rebuild** — we reuse the infrastructure
and change the domain.

---

## 1. Current codebase analysis

A working, well-layered app — but built for **one purpose: cold-email outreach to
win dealership clients** for a single business (Amei Auto Detailz).

**Frontend** (Vite + React + TS + Tailwind, React Router, Recharts, Framer Motion)
- Shell: `AppLayout`, `Sidebar`, `Topbar`, reusable UI (`Card`, `Button`, `Badge`,
  `StatCard`, `PageHeader`, `Sparkline`), theme, route code-splitting.
- Pages: Dashboard, Contacts, Campaigns, Templates, Analytics, Settings, Login.
- `lib/`: Supabase auth (just fixed), `api` client, demo-mode fallback (`useLeads`).

**Backend** (Express + TS + Supabase)
- Clean layers: `routes → controllers → services → Supabase`, with middleware
  (`auth`, `validate`, `rateLimiter`, `errorHandler`), `ApiError`, `asyncHandler`,
  validated `env`, and a **per-request Supabase client scoped to the user's JWT**.
- Resource modules: auth, users, contacts, leads, campaigns, templates, follow-ups,
  email (send engine + provider adapter), webhooks, ai (scoring, reply analysis).
- `jobs/scheduler.ts` (node-cron), Vitest tests, production configs.

**Database** (Supabase Postgres — `schema.sql`, `002`, `003`)
- Tables: `profiles`, `businesses`, `contacts`, `leads`, `email_templates`,
  `campaigns`, `campaign_recipients`, `sent_emails`, `email_events`, `follow_ups`,
  `suppressions`, `lead_activities`; AI score columns; analytics view.
- **Tenancy: single-user.** Every row has `owner_id` and RLS is `owner_id = auth.uid()`.

---

## 2. Current architecture

```
React SPA ──JWT──> Express API ──RLS-scoped client──> Supabase (Postgres + Auth)
                     │
                     ├── Email provider (SendGrid / console) + node-cron scheduler
                     └── Anthropic (lead scoring, reply analysis)
```

Three defining design decisions, all worth keeping:
1. **RLS is the security boundary** — the API builds a Supabase client from the
   caller's JWT, so Postgres enforces isolation, not just app code.
2. **Layered, typed backend** — thin controllers, logic in services, zod validation,
   one error shape.
3. **Composable frontend shell** — one layout + a small UI kit every page reuses.

**The limiting assumption:** *one user owns everything they can see.* That's correct
for a personal tool and fatal for a team SaaS.

---

## 3. What needs to change

Detail Support is a **different product on the same foundation**. The current app does
**customer acquisition** (cold outreach). Detail Support does **customer operations**
(run the detailing business day-to-day). Roughly **~70% of the infrastructure is
reusable; the domain model and product surface are mostly new.**

### The one change everything depends on: multi-tenancy
Today: `owner_id = auth.uid()` (one user = one silo). Detail Support needs a business
to have **multiple team members** ("Teams" is a required feature), so:
- New `organizations` (a detailing business) + `memberships` (users↔orgs with roles).
- Every table's tenancy key moves from `owner_id` → **`org_id`**.
- RLS changes from *"is this mine?"* to *"am I a member of the org that owns this?"*.
- Signup provisions an org + an owner membership; the API resolves the caller's
  current org per request.

### Keep / Evolve / Retire

**KEEP (reuse as-is or lightly adapted) — this is the "don't rebuild" core:**
- Supabase auth + the fixed login/signup flow.
- Entire backend layering: routes/controllers/services, all middleware, `ApiError`,
  `asyncHandler`, env config, and the per-request RLS-scoped client pattern.
- Frontend shell + UI kit + theme + code-splitting + demo-mode + `api` client.
- Email infrastructure (provider adapter, render, send engine, scheduler).
- AI infrastructure (Anthropic client, structured outputs).
- The `lead_activities` **activity-timeline pattern** (becomes customer history).
- Tests, Vercel/Docker/Render configs, CI approach.

**EVOLVE (repurpose the concept, adjust the schema/UI):**
- `campaigns` + `email_templates` + `sent_emails` + `email_events` + `suppressions`
  → **Marketing tools** (email/SMS your own customers: review requests, promos, wins).
- `follow_ups` → **appointment reminders + customer follow-ups**.
- `lead_activities` → **customer history / activity timeline**.
- Analytics view + page → **business analytics** (revenue, jobs, tech utilization).
- AI scoring → **customer value / churn-risk insights**; reply analysis → marketing.
- Dashboard → **operations dashboard** (today's appointments, revenue, outstanding).
- Settings → **org settings + team management + billing**.

**RETIRE / DEMOTE (the cold-outreach lead-gen model):**
- `leads`, `businesses` (as outreach *targets*), `contacts` (as outreach contacts),
  CSV lead import, lead-scoring-for-outreach, `suppressions` as a cold-email list.
- These served "win dealership clients." In Detail Support this is, at most, an
  optional **inbound Leads** feature (a web-form lead → convert to a customer).
- Note: outreach `contacts`/`businesses` **don't cleanly become** `customers`/
  `vehicles` — different shape — so these are new tables, not renames.

**NEW (the operational core — mostly greenfield):**
- `organizations`, `memberships`, `invitations` (tenancy + teams + roles).
- `customers` (the detailer's clients).
- `vehicles` (belong to a customer: make/model/year/color/plate/VIN/notes).
- `services` (catalog: name, price, duration, category).
- `appointments` (customer + vehicle + service(s) + assigned tech + time + status).
- `invoices` + `invoice_line_items` + `payments`.
- `customer_notes` / activity (customer history — reuse the timeline pattern).
- `equipment_recommendations` (AI, per business profile/services).
- **Billing** (Stripe): SaaS subscription (plans/seats) + optional customer payments.

---

## 4. Migration plan (incremental, foundation-first)

Because the app has **essentially no production data yet** (Supabase was connected
minutes ago; only test users exist), this is the ideal moment to pivot — we redefine
the schema cleanly instead of migrating live customer data. Build the new tables as a
fresh migration set; keep old outreach tables only if we keep the optional Leads
feature.

| Phase | Goal | Ships |
|---|---|---|
| **0. Tenancy foundation** | Multi-tenant everything | `organizations` + `memberships` + `invitations`; `org_id` on all tables; membership-based RLS; signup provisions org + owner; API resolves current org. *Load-bearing — everything else depends on it.* |
| **1. Operational core** | The daily loop | `customers`, `vehicles`, `services`, `appointments` (+ calendar UI). Backend CRUD + pages. **This is the Detail Support MVP.** |
| **2. Money + history** | Get paid, remember | `invoices` + line items + `payments` (Stripe customer payments); customer history/timeline. |
| **3. Team + roles** | Multi-user | Memberships UI, email invitations, role permissions (owner/manager/tech), assign techs to appointments. |
| **4. Growth** | Retain + upsell | Business analytics (revenue/utilization), marketing tools (repurposed email → review requests/promos/reminders), AI equipment recs + customer insights. |
| **5. SaaS-ify** | Monetize | Subscription billing (Stripe plans/seats), guided onboarding, per-org branding, plan limits. |

**Order rationale:** tenancy first (nothing is safe without it), then the loop a
detailer lives in daily (customer → vehicle → appointment → invoice), then team, then
growth, then monetization. Each phase is independently shippable.

**Reuse leverage per phase:** every phase rides the existing backend layering, RLS
pattern, frontend shell, and (for 2/5) needs Stripe added; (4) reuses email + AI infra
wholesale.

---

## 5. Updated product architecture (target)

**Tenancy**
- `organization` = one detailing business (the tenant). `membership` links a user to an
  org with a `role` (owner / manager / technician). A user can belong to multiple orgs;
  the API resolves the active org per request. RLS: *row visible iff caller is a member
  of `row.org_id`.*

**Stack (unchanged shape, one addition)**
```
React SPA ──JWT──> Express API ──org-scoped RLS──> Supabase (Postgres + Auth)
                     ├── Stripe (subscription billing + customer payments)   ← NEW
                     ├── Email/SMS provider + scheduler (reminders, marketing)
                     └── Anthropic (equipment recs, customer insights)
```

**Data model (new core, all `org_id`-scoped)**
```
organizations ─< memberships >─ auth.users
organizations ─< customers ─< vehicles
customers ─< appointments >─ vehicles, services, memberships(tech)
appointments ─< invoices ─< invoice_line_items ; invoices ─< payments
customers ─< customer_activity (history timeline)
organizations ─< services, equipment_recommendations
```

**Module map (nav)**
- Dashboard (ops: today's jobs, revenue, outstanding invoices)
- Customers → Vehicles (nested) → Customer history
- Appointments / Calendar
- Invoices & Payments
- Team (members, roles, invites)
- Analytics (revenue, utilization, top services)
- Marketing (campaigns, review requests, reminders)
- Equipment (AI recommendations)
- Settings & Billing

**Roles**
- **Owner** — everything incl. billing + team.
- **Manager** — full operations, no billing.
- **Technician** — their assigned appointments + read customer/vehicle.

---

## Decisions (LOCKED)

1. **Payments — track/mark-paid only** (no Stripe Connect yet). Invoice statuses:
   **Unpaid · Deposit paid · Remaining balance · Paid**. Actions: create, send,
   mark status. Add Stripe later once there are many users.
2. **Leads — keep as an optional module** (not forced). A lead has name, phone/email,
   and status: **New · Contacted · Follow-up · Won · Lost**. Reuses the existing
   outreach tables, repackaged.
3. **One shop per organization** for now (`Business Account → Shop → Customers /
   Appointments / Invoices`). Multi-location (org → locations) is a later addition.
4. **Flat monthly billing.** 14-day free trial. **Pro $5/mo** (unlimited customers,
   booking, invoices, reminders). **Team $15/mo** (multiple employees, more features).
   No per-seat / per-location pricing.
5. **Email reminders first** (appointment confirmation, day-before reminder, invoice
   reminder, review request). **SMS later** (Twilio).

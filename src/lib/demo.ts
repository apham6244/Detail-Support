/**
 * Demo Mode — a fully in-memory sample workspace for visitors.
 *
 * Design rules (deliberate, please keep them):
 *  • NOTHING here ever touches Supabase. Every data hook checks `isDemo()` and
 *    returns these constants *before* issuing a query, so demo performs zero
 *    reads and zero writes against the database.
 *  • The flag lives in sessionStorage, so it's scoped to one tab and vanishes
 *    when that tab closes — it can't bleed into a later real login.
 *  • `isDemo()` is a plain function (not a React context) so the auth provider
 *    and the hooks can read it without any provider-ordering hazard.
 *  • A real Supabase session always wins: the synthetic demo identity is only
 *    applied when there is no real session (see auth.tsx).
 *  • Every mutation calls `demoGuard()`, which throws before doing anything.
 */
import type {
  Customer, Vehicle, Service, Appointment, Invoice, Lead, AppointmentStatus,
} from "@/lib/models";

const KEY = "ds.demo";

/** True when this tab is exploring the demo workspace. */
export function isDemo(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function enterDemo() {
  try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ }
}

export function exitDemo() {
  try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
}

/**
 * Enter/leave demo with a REAL navigation rather than a client-side route
 * change. `isDemo()` is read during render by AuthProvider, which sits above
 * the router and so doesn't re-render on a client-side navigate — a full load
 * guarantees every provider and hook re-initialises with the new mode, and
 * guarantees no demo-derived state survives on the way out.
 */
export function startDemo() {
  enterDemo();
  // `replace` (not assign) so Back doesn't bounce through the entry point.
  window.location.replace("/");
}

export function leaveDemo(to = "/welcome") {
  exitDemo();
  window.location.replace(to);
}

/** Called at the top of every mutation. In demo it stops the write cold. */
export function demoGuard() {
  if (isDemo()) {
    throw new Error("Demo mode — this is a read-only preview. Create an account to make changes.");
  }
}

// ---------------------------------------------------------------------------
// Synthetic identity (never persisted, never sent anywhere)
// ---------------------------------------------------------------------------

export const DEMO_ORG = { id: "demo-org", name: "Apex Auto Detailing", plan: "team" };
export const DEMO_USER = { id: "demo-user", email: "demo@detailsupport.app" };
export const DEMO_PROFILE = { full_name: "Alex Rivera", business_name: "Apex Auto Detailing" };
export const DEMO_ROLE = "owner";

// A fully-populated workspace so the Settings control center renders in demo
// (the demo org isn't in the DB, so useWorkspace can't load it). Writes stay
// in-memory in demo — nothing here touches Supabase.
export const DEMO_WORKSPACE = {
  id: DEMO_ORG.id,
  name: DEMO_ORG.name,
  plan: DEMO_ORG.plan,
  trial_ends_at: null,
  settings: {
    owner_name: DEMO_PROFILE.full_name,
    phone: "(214) 555-0100",
    business_email: "hello@apexautodetailing.example",
    location: "Plano, TX",
    tagline: "Showroom shine, every time.",
    tax_enabled: true,
    tax_label: "Sales tax",
    tax_rate: 8.25,
    notif_new_booking: true,
    notif_reminders: true,
    notif_review_requests: true,
    notif_payment: true,
    notif_sms: false,
    ai_recommendations: true,
    ai_business_coach: true,
    pay_deposit_pct: 25,
    pay_terms_days: 7,
    pay_footer: "Thank you for your business!",
    cal_default_duration: 120,
    cal_week_start: "sun" as const,
    cal_open: "08:00",
    cal_close: "18:00",
  },
};

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth();
const D = now.getDate();
const at = (y: number, m: number, d: number, h = 10, min = 0) =>
  new Date(y, m, d, h, min, 0).toISOString();

export const DEMO_SERVICES: Service[] = [
  { id: "s1", name: "Full Detail", description: "Interior + exterior, top to bottom", price: 265, duration_min: 240, category: "Detail", active: true },
  { id: "s2", name: "Interior Detail", description: "Deep clean, shampoo, protect", price: 165, duration_min: 120, category: "Interior", active: true },
  { id: "s3", name: "Paint Correction", description: "Single-stage machine polish", price: 450, duration_min: 300, category: "Correction", active: true },
  { id: "s4", name: "Ceramic Coating", description: "Multi-year paint protection", price: 900, duration_min: 480, category: "Protection", active: true },
  { id: "s5", name: "Maintenance Wash", description: "Keep-it-clean recurring wash", price: 95, duration_min: 90, category: "Wash", active: true },
];

const NAMES: [string, string, string][] = [
  // name, phone, email
  ["John Smith", "(214) 555-0142", "john.smith@example.com"],
  ["Sarah Johnson", "(469) 555-0117", "sarah.johnson@example.com"],
  ["Mike Rodriguez", "(972) 555-0188", "mike.rodriguez@example.com"],
  ["Emily Chen", "(214) 555-0164", "emily.chen@example.com"],
  ["David Okafor", "(469) 555-0133", "david.okafor@example.com"],
  ["Priya Sharma", "(972) 555-0109", "priya.sharma@example.com"],
  ["Marcus Webb", "(214) 555-0175", "marcus.webb@example.com"],
  ["Elena Petrova", "(469) 555-0151", "elena.petrova@example.com"],
  ["Chris Donnelly", "(972) 555-0126", "chris.donnelly@example.com"],
  ["Nina Rossi", "(214) 555-0193", "nina.rossi@example.com"],
  ["Tomas Novak", "(469) 555-0148", "tomas.novak@example.com"],
  ["Grace Kim", "(972) 555-0182", "grace.kim@example.com"],
];

// How each demo customer found the shop — so the profile's referral insight has
// something real to show. Order matches NAMES.
const REFERRAL_SOURCES = [
  "Instagram", "Referral", "Google", "Walk-in", "Facebook", "Website",
  "Referral", "Instagram", "Google", "Referral", "Walk-in", "Google",
];

export const DEMO_CUSTOMERS: Customer[] = NAMES.map(([name, phone, email], i) => ({
  id: `c${i}`,
  name,
  email,
  phone,
  address: `${1200 + i * 37} Preston Rd, Plano, TX`,
  notes: i === 0 ? "Prefers weekend mornings. Garage-kept." : null,
  referral_source: REFERRAL_SOURCES[i % REFERRAL_SOURCES.length],
  // Spread joins across 6 months so "customer growth" has a real curve.
  created_at: at(Y, M - Math.min(5, Math.floor(i / 2)), 3 + ((i * 5) % 24)),
}));

const CARS: [number, string, string, string][] = [
  [2024, "BMW", "M4", "Frozen Grey"],
  [2023, "Tesla", "Model S", "Pearl White"],
  [2022, "Porsche", "911", "Guards Red"],
  [2023, "Mercedes", "GLE", "Obsidian Black"],
  [2021, "Audi", "RS5", "Nardo Grey"],
  [2024, "Rivian", "R1T", "Forest Green"],
  [2022, "Lexus", "RX", "Silver"],
  [2023, "Ford", "F-150", "Blue"],
  [2020, "Honda", "Accord", "White"],
  [2022, "Toyota", "Highlander", "Graphite"],
  [2021, "Subaru", "Outback", "Green"],
  [2023, "Chevrolet", "Tahoe", "Black"],
];

export const DEMO_VEHICLES: Vehicle[] = CARS.map(([year, make, model, color], i) => ({
  id: `v${i}`,
  customer_id: `c${i}`,
  year, make, model, color,
  license_plate: `APX-${String(100 + i)}`,
  vin: null,
  notes: null,
}));

// ---- 6 months of jobs + invoices -------------------------------------------

const appts: Appointment[] = [];
const invoices: Invoice[] = [];
let seq = 0;
let invNo = 1;

// Monthly revenue targets that climb — makes the analytics curve believable.
const MONTH_TARGET = [3150, 3720, 4260, 4980, 5540, 6180];

MONTH_TARGET.forEach((target, idx) => {
  const off = 5 - idx;                       // 5 months ago → this month
  const d0 = new Date(Y, M - off, 1);
  const y = d0.getFullYear();
  const m = d0.getMonth();
  const lastDay = off === 0 ? Math.max(D - 1, 1) : new Date(y, m + 1, 0).getDate();

  let sum = 0;
  const jobs: Service[] = [];
  while (true) {
    const s = DEMO_SERVICES[seq % DEMO_SERVICES.length];
    seq++;
    if (sum + s.price > target) break;
    jobs.push(s);
    sum += s.price;
  }

  jobs.forEach((s, i) => {
    const ci = (seq + i * 3) % DEMO_CUSTOMERS.length;
    const cust = DEMO_CUSTOMERS[ci];
    const day = Math.min(lastDay, 1 + Math.floor((i / Math.max(jobs.length, 1)) * (lastDay - 1)));
    const when = at(y, m, day, 8 + (i % 9));
    appts.push({
      id: `a${appts.length}`,
      customer_id: cust.id,
      vehicle_id: `v${ci}`,
      service_id: s.id,
      assigned_to: null,
      scheduled_at: when,
      duration_min: s.duration_min,
      status: "completed",
      price: s.price,
      notes: null,
      customer: { name: cust.name },
      vehicle: { year: CARS[ci][0], make: CARS[ci][1], model: CARS[ci][2] },
      service: { name: s.name },
    });
    // Most are paid; leave a couple open in the current month for realism.
    const openIt = off === 0 && i % 5 === 2;
    invoices.push({
      id: `i${invoices.length}`,
      number: `INV-${String(invNo++).padStart(4, "0")}`,
      customer_id: cust.id,
      status: openIt ? "unpaid" : "paid",
      subtotal: s.price,
      tax: 0,
      total: s.price,
      deposit_amount: 0,
      notes: openIt ? "Awaiting payment" : "Paid in full",
      issued_at: when,
      due_at: at(y, m, Math.min(day + 14, 28), 12),
      sent_at: openIt ? when : when,
      created_at: when,
      customer: { name: cust.name },
    });
  });
});

// ---- Today's board + upcoming ----------------------------------------------

const LIVE: { status: AppointmentStatus; svc: number; ci: number; hour: number }[] = [
  { status: "completed", svc: 1, ci: 0, hour: 8 },
  { status: "in_progress", svc: 0, ci: 1, hour: 11 },
  { status: "confirmed", svc: 2, ci: 2, hour: 14 },
  { status: "scheduled", svc: 4, ci: 3, hour: 16 },
];
LIVE.forEach((l, i) => {
  const s = DEMO_SERVICES[l.svc];
  const cust = DEMO_CUSTOMERS[l.ci];
  appts.push({
    id: `today${i}`,
    customer_id: cust.id, vehicle_id: `v${l.ci}`, service_id: s.id, assigned_to: null,
    scheduled_at: at(Y, M, D, l.hour), duration_min: s.duration_min,
    status: l.status, price: s.price, notes: null,
    customer: { name: cust.name },
    vehicle: { year: CARS[l.ci][0], make: CARS[l.ci][1], model: CARS[l.ci][2] },
    service: { name: s.name },
  });
});

for (let i = 1; i <= 6; i++) {
  const ci = (i * 2) % DEMO_CUSTOMERS.length;
  const s = DEMO_SERVICES[i % DEMO_SERVICES.length];
  const cust = DEMO_CUSTOMERS[ci];
  appts.push({
    id: `next${i}`,
    customer_id: cust.id, vehicle_id: `v${ci}`, service_id: s.id, assigned_to: null,
    scheduled_at: at(Y, M, D + i, 9 + (i % 7)), duration_min: s.duration_min,
    status: i % 3 === 0 ? "confirmed" : "scheduled", price: s.price, notes: null,
    customer: { name: cust.name },
    vehicle: { year: CARS[ci][0], make: CARS[ci][1], model: CARS[ci][2] },
    service: { name: s.name },
  });
}

export const DEMO_APPOINTMENTS = appts;
export const DEMO_INVOICES = invoices;

// ---- Leads ------------------------------------------------------------------

export const DEMO_LEADS: Lead[] = [
  { id: "l1", org_id: "demo-org", name: "Ryan Mitchell", phone: "(214) 555-0210", email: "ryan.m@example.com", vehicle: "2024 Corvette C8", service: "Ceramic coating", estimated_value: 1200, source: "instagram", status: "quote_sent", notes: "Wants it done before a show.", last_contacted_at: at(Y, M, Math.max(D - 2, 1)), converted_customer_id: null, created_at: at(Y, M, Math.max(D - 5, 1)), updated_at: at(Y, M, Math.max(D - 2, 1)) },
  { id: "l2", org_id: "demo-org", name: "Ashley Nguyen", phone: "(469) 555-0221", email: "ashley.n@example.com", vehicle: "2022 Range Rover", service: "Full detail", estimated_value: 265, source: "google", status: "new", notes: null, last_contacted_at: null, converted_customer_id: null, created_at: at(Y, M, Math.max(D - 1, 1)), updated_at: at(Y, M, Math.max(D - 1, 1)) },
  { id: "l3", org_id: "demo-org", name: "Brandon Lee", phone: "(972) 555-0233", email: null, vehicle: "2021 Jeep Wrangler", service: "Monthly maintenance", estimated_value: 95, source: "referral", status: "scheduled", notes: "Recurring every 4 weeks.", last_contacted_at: at(Y, M, Math.max(D - 3, 1)), converted_customer_id: null, created_at: at(Y, M, Math.max(D - 8, 1)), updated_at: at(Y, M, Math.max(D - 3, 1)) },
  { id: "l4", org_id: "demo-org", name: "Danielle Foster", phone: "(214) 555-0244", email: "danielle.f@example.com", vehicle: "2023 Audi Q7", service: "Interior detail", estimated_value: 165, source: "facebook", status: "contacted", notes: "Left a voicemail.", last_contacted_at: at(Y, M, Math.max(D - 4, 1)), converted_customer_id: null, created_at: at(Y, M - 1, 22), updated_at: at(Y, M, Math.max(D - 4, 1)) },
  { id: "l5", org_id: "demo-org", name: "Victor Ramos", phone: "(469) 555-0255", email: "victor.r@example.com", vehicle: "2020 Mustang GT", service: "Paint correction", estimated_value: 450, source: "website", status: "won", notes: "Booked for next week.", last_contacted_at: at(Y, M - 1, 26), converted_customer_id: null, created_at: at(Y, M - 1, 18), updated_at: at(Y, M - 1, 26) },
  { id: "l6", org_id: "demo-org", name: "Kelly Adams", phone: null, email: "kelly.a@example.com", vehicle: "2019 Mazda CX-5", service: "Headlight restoration", estimated_value: 120, source: "walk_in", status: "lost", notes: "Went elsewhere on price.", last_contacted_at: at(Y, M - 1, 12), converted_customer_id: null, created_at: at(Y, M - 1, 8), updated_at: at(Y, M - 1, 12) },
];

// ---- Google reviews (shape matches useGoogleReviews) ------------------------

export const DEMO_REVIEW_CONNECTION = {
  provider: "places",
  placeId: "demo-place",
  name: "Apex Auto Detailing",
  address: "1820 Preston Rd, Plano, TX 75093",
  connectedAt: at(Y, M - 2, 4),
};

export const DEMO_REVIEWS_PAYLOAD = {
  connected: DEMO_REVIEW_CONNECTION,
  business: { placeId: "demo-place", name: "Apex Auto Detailing", address: "1820 Preston Rd, Plano, TX 75093", rating: 4.9, totalReviews: 187 },
  mapsUrl: "https://maps.google.com/",
  rating: 4.9,
  totalReviews: 187,
  reviewLimit: 5,
  provider: "places",
  sampled: true,
  reviews: [
    { id: "gr1", author: "John Smith", authorPhoto: null, rating: 5, text: "Brought in my M4 and it came back better than the day I picked it up. The paint correction is flawless — no swirls left at all.", publishedAt: at(Y, M, Math.max(D - 3, 1)), relativeTime: "3 days ago", ownerResponse: { text: "Thanks John! That M4 is a stunner — see you at the next maintenance wash.", publishedAt: at(Y, M, Math.max(D - 2, 1)) } },
    { id: "gr2", author: "Sarah Johnson", authorPhoto: null, rating: 5, text: "The ceramic coating on my Model S still beads like day one after four months. Worth every dollar.", publishedAt: at(Y, M, Math.max(D - 11, 1)), relativeTime: "a week ago", ownerResponse: null },
    { id: "gr3", author: "Mike Rodriguez", authorPhoto: null, rating: 5, text: "They picked up my 911, detailed it, and had it back the same afternoon. Super professional crew.", publishedAt: at(Y, M - 1, 21), relativeTime: "a month ago", ownerResponse: { text: "Appreciate it Mike — always a pleasure working on that 911.", publishedAt: at(Y, M - 1, 22) } },
    { id: "gr4", author: "Emily Chen", authorPhoto: null, rating: 4, text: "Great interior work, seats look new. Took a little longer than quoted but the result was worth it.", publishedAt: at(Y, M - 1, 9), relativeTime: "a month ago", ownerResponse: null },
    { id: "gr5", author: "David Okafor", authorPhoto: null, rating: 5, text: "Best detailer in the DFW area. Honest pricing and they actually explain what they're doing.", publishedAt: at(Y, M - 2, 16), relativeTime: "2 months ago", ownerResponse: null },
  ],
};

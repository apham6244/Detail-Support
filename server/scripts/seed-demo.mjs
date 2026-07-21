/**
 * Demo data seeder for the Detail Support owner account.
 *
 * Regenerates a realistic, professional-looking dataset for ONE org (resolved by
 * the owner's email) and guarantees the CURRENT month's collected revenue lands
 * on an exact target (default $5,000).
 *
 * Everything it creates is tagged so it can be removed cleanly:
 *   • customer emails  → @example.com
 *   • notes/addresses  → "[DEMO] …"
 *   • plates           → "DEMO-xx"
 *   • phones           → (xxx) 555-01xx
 *
 * Re-running is safe: it deletes the previous demo rows first (scoped to this
 * org + the demo markers only — real rows are never touched), then reseeds.
 *
 *   cd server && node scripts/seed-demo.mjs
 *
 * Revenue model (matches Dashboard/Analytics): collected = invoices where
 * issued_at is in the period, counting `paid` → total and `deposit_paid` →
 * deposit_amount.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "apham6244@gmail.com";
const MONTH_TARGET = Number(process.env.SEED_MONTH_TARGET ?? 5000);

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const money = (n) => Math.round(n * 100) / 100;
const pick = (arr, i) => arr[i % arr.length];
const at = (y, m, d, h = 10, min = 0) => new Date(y, m, d, h, min, 0).toISOString();

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const SERVICES = [
  { name: "Express Wash", price: 60, duration_min: 45, category: "Wash" },
  { name: "Maintenance Detail", price: 95, duration_min: 90, category: "Wash" },
  { name: "Interior Detail", price: 165, duration_min: 120, category: "Interior" },
  { name: "Exterior Detail", price: 145, duration_min: 120, category: "Exterior" },
  { name: "Full Detail", price: 265, duration_min: 240, category: "Detail" },
  { name: "Paint Correction (1-Step)", price: 450, duration_min: 300, category: "Correction" },
  { name: "Ceramic Coating", price: 900, duration_min: 480, category: "Protection" },
  { name: "Headlight Restoration", price: 80, duration_min: 60, category: "Add-on" },
  { name: "Pet Hair Removal", price: 70, duration_min: 60, category: "Add-on" },
  { name: "Engine Bay Detail", price: 85, duration_min: 60, category: "Add-on" },
];

const FIRST = ["Alex","Maya","Daniel","Priya","Marcus","Sofia","Ethan","Grace","Noah","Elena","Jordan","Amara","Chris","Nina","Tomas","Leah","Andre","Claire","Victor","Hannah","Owen","Bianca","Felix","Rosa","Dean","Talia","Miles","Jasmine"];
const LAST = ["Carter","Nguyen","Reyes","Sharma","Webb","Delgado","Brooks","Kim","Alvarez","Petrova","Blake","Okafor","Donnelly","Rossi","Novak","Bennett","Laurent","Whitfield","Ramos","Lee","Fletcher","Moreau","Hartman","Silva","Coleman","Haddad","Sutton","Park"];
const CITIES = ["Plano, TX","Frisco, TX","Allen, TX","McKinney, TX","Richardson, TX","Dallas, TX"];
const MAKES = [
  ["Tesla","Model 3"],["Tesla","Model Y"],["BMW","X5"],["BMW","M4"],["Mercedes","C300"],["Mercedes","GLE"],
  ["Audi","Q5"],["Audi","A4"],["Porsche","Macan"],["Porsche","911"],["Toyota","Highlander"],["Toyota","Tacoma"],
  ["Honda","Accord"],["Honda","CR-V"],["Ford","F-150"],["Ford","Bronco"],["Lexus","RX"],["Jeep","Wrangler"],
  ["Subaru","Outback"],["Chevrolet","Tahoe"],["Rivian","R1T"],["Volkswagen","Golf"],
];
const COLORS = ["Black","White","Silver","Gunmetal","Deep Blue","Red","Pearl White","Graphite"];

// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n🔎 Resolving org for ${OWNER_EMAIL} …`);

  // Find the owner user, then their org.
  let userId = null;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === OWNER_EMAIL.toLowerCase());
    if (hit) userId = hit.id;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error(`No auth user found for ${OWNER_EMAIL}`);

  const { data: orgs, error: orgErr } = await db
    .from("organizations").select("id, name").eq("owner_user_id", userId).limit(1);
  if (orgErr) throw new Error(orgErr.message);
  if (!orgs?.length) throw new Error("That user doesn't own an organization.");
  const org = orgs[0];
  console.log(`   ✓ ${org.name} (${org.id})`);

  // ---- 1. Clear previous demo rows (scoped + marker-matched only) ---------
  console.log("\n🧹 Clearing previous demo data …");
  const { data: oldCustomers } = await db
    .from("customers").select("id").eq("org_id", org.id).like("email", "%@example.com");
  if (oldCustomers?.length) {
    // vehicles / appointments / invoices / line_items all cascade from customers
    await db.from("customers").delete().in("id", oldCustomers.map((c) => c.id));
    console.log(`   ✓ removed ${oldCustomers.length} demo customers (cascaded their vehicles/jobs/invoices)`);
  }
  await db.from("services").delete().eq("org_id", org.id).like("description", "[DEMO]%");
  const { error: leadWipeErr } = await db.from("leads").delete().eq("org_id", org.id).like("notes", "[DEMO]%");
  const leadsTableExists = !leadWipeErr;

  // ---- 2. Services --------------------------------------------------------
  const serviceRows = SERVICES.map((s) => ({
    org_id: org.id, name: s.name, description: `[DEMO] ${s.category} service`,
    price: s.price, duration_min: s.duration_min, category: s.category, active: true,
  }));
  const { data: services, error: svcErr } = await db.from("services").insert(serviceRows).select("id, name, price");
  if (svcErr) throw new Error(`services: ${svcErr.message}`);
  console.log(`   ✓ ${services.length} services`);

  const svcByName = Object.fromEntries(services.map((s) => [s.name, s]));

  // ---- 3. Customers -------------------------------------------------------
  const CUSTOMER_COUNT = 26;
  const customerRows = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const name = `${pick(FIRST, i)} ${pick(LAST, i * 7 + 3)}`;
    customerRows.push({
      org_id: org.id,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      phone: `(${[214, 469, 972][i % 3]}) 555-01${String(10 + i).slice(-2)}`,
      address: `[DEMO] ${100 + i * 7} ${pick(["Oak","Maple","Cedar","Elm","Birch"], i)} St, ${pick(CITIES, i)}`,
      notes: "[DEMO] Seeded sample customer.",
    });
  }
  const { data: customers, error: custErr } = await db.from("customers").insert(customerRows).select("id, name");
  if (custErr) throw new Error(`customers: ${custErr.message}`);
  console.log(`   ✓ ${customers.length} customers`);

  // ---- 4. Vehicles --------------------------------------------------------
  const vehicleRows = [];
  customers.forEach((c, i) => {
    const count = i % 4 === 0 ? 2 : 1;
    for (let v = 0; v < count; v++) {
      const [make, model] = pick(MAKES, i * 2 + v);
      vehicleRows.push({
        org_id: org.id, customer_id: c.id,
        year: 2017 + ((i + v) % 9), make, model, color: pick(COLORS, i + v),
        license_plate: `DEMO-${String(i * 2 + v).padStart(2, "0")}`,
        notes: "[DEMO] Seeded sample vehicle.",
      });
    }
  });
  const { data: vehicles, error: vehErr } = await db.from("vehicles").insert(vehicleRows).select("id, customer_id");
  if (vehErr) throw new Error(`vehicles: ${vehErr.message}`);
  console.log(`   ✓ ${vehicles.length} vehicles`);
  const vehicleOf = (customerId) => vehicles.find((v) => v.customer_id === customerId)?.id ?? null;

  // ---- 5. Plan the job/invoice history -----------------------------------
  const now = new Date();
  const Y = now.getFullYear();
  const M = now.getMonth(); // current month index
  const today = now.getDate();

  // Rising 6-month trend; the current month is forced to MONTH_TARGET exactly.
  const history = [
    { offset: 5, target: 2150 },
    { offset: 4, target: 2780 },
    { offset: 3, target: 3240 },
    { offset: 2, target: 3900 },
    { offset: 1, target: 4420 },
    { offset: 0, target: MONTH_TARGET },
  ];

  const menu = [
    svcByName["Express Wash"], svcByName["Maintenance Detail"], svcByName["Interior Detail"],
    svcByName["Exterior Detail"], svcByName["Full Detail"], svcByName["Paint Correction (1-Step)"],
    svcByName["Headlight Restoration"], svcByName["Engine Bay Detail"], svcByName["Pet Hair Removal"],
  ];

  const appointments = [];
  const invoicePlans = [];
  let invNo = 1;
  let seq = 0;

  for (const { offset, target } of history) {
    const mDate = new Date(Y, M - offset, 1);
    const y = mDate.getFullYear();
    const m = mDate.getMonth();
    const lastDay = offset === 0 ? Math.max(today - 1, 1) : new Date(y, m + 1, 0).getDate();

    // Build jobs until we're just under target, then a final job closes the gap.
    let collected = 0;
    const jobs = [];
    while (true) {
      const svc = pick(menu, seq++);
      const price = Number(svc.price);
      if (collected + price >= target) break;
      jobs.push({ svc, price });
      collected += price;
    }
    const gap = money(target - collected);
    if (gap > 0) jobs.push({ svc: svcByName["Full Detail"], price: gap });

    jobs.forEach((job, i) => {
      const cust = pick(customers, seq + i * 3);
      const day = Math.min(lastDay, 1 + Math.floor((i / jobs.length) * (lastDay - 1)));
      const hour = 8 + (i % 8);
      const when = at(y, m, day, hour);
      appointments.push({
        org_id: org.id, customer_id: cust.id, vehicle_id: vehicleOf(cust.id),
        service_id: job.svc.id, scheduled_at: when, duration_min: 120,
        status: "completed", price: job.price, notes: "[DEMO] Completed job.",
      });
      invoicePlans.push({
        customer_id: cust.id, total: job.price, issued_at: when,
        number: `INV-${String(invNo++).padStart(4, "0")}`,
        description: job.svc.name, status: "paid",
      });
    });
  }

  // Today's board + upcoming week (no invoices — not collected yet).
  const liveStatuses = ["completed", "in_progress", "confirmed", "scheduled"];
  liveStatuses.forEach((status, i) => {
    const cust = pick(customers, 5 + i * 4);
    appointments.push({
      org_id: org.id, customer_id: cust.id, vehicle_id: vehicleOf(cust.id),
      service_id: pick(menu, i + 2).id, scheduled_at: at(Y, M, today, 8 + i * 2, 30),
      duration_min: 120, status, price: Number(pick(menu, i + 2).price),
      notes: "[DEMO] Today's board.",
    });
  });
  for (let i = 1; i <= 7; i++) {
    const cust = pick(customers, 11 + i * 2);
    appointments.push({
      org_id: org.id, customer_id: cust.id, vehicle_id: vehicleOf(cust.id),
      service_id: pick(menu, i).id, scheduled_at: at(Y, M, today + i, 9 + (i % 6)),
      duration_min: 120, status: i % 3 === 0 ? "confirmed" : "scheduled",
      price: Number(pick(menu, i).price), notes: "[DEMO] Upcoming booking.",
    });
  }

  const { data: appts, error: apptErr } = await db.from("appointments").insert(appointments).select("id, scheduled_at, customer_id, status");
  if (apptErr) throw new Error(`appointments: ${apptErr.message}`);
  console.log(`   ✓ ${appts.length} appointments`);

  // ---- 6. Invoices --------------------------------------------------------
  const invoiceRows = invoicePlans.map((p) => ({
    org_id: org.id, customer_id: p.customer_id, number: p.number, status: p.status,
    subtotal: p.total, tax: 0, total: p.total, deposit_amount: 0,
    notes: "[DEMO] Paid in full.", issued_at: p.issued_at, due_at: p.issued_at,
    sent_at: p.issued_at,
  }));

  // A little realistic outstanding AR this month (contributes $0 to collected).
  const openA = pick(customers, 3), openB = pick(customers, 9);
  invoiceRows.push({
    org_id: org.id, customer_id: openA.id, number: `INV-${String(invNo++).padStart(4, "0")}`,
    status: "unpaid", subtotal: 265, tax: 0, total: 265, deposit_amount: 0,
    notes: "[DEMO] Awaiting payment.", issued_at: at(Y, M, Math.max(today - 2, 1), 11),
    due_at: at(Y, M, today + 12, 11), sent_at: at(Y, M, Math.max(today - 2, 1), 11),
  });
  invoiceRows.push({
    org_id: org.id, customer_id: openB.id, number: `INV-${String(invNo++).padStart(4, "0")}`,
    status: "unpaid", subtotal: 450, tax: 0, total: 450, deposit_amount: 0,
    notes: "[DEMO] Overdue — follow up.", issued_at: at(Y, M - 1, 20, 11),
    due_at: at(Y, M - 1, 27, 11), sent_at: at(Y, M - 1, 20, 11),
  });

  const { data: invoices, error: invErr } = await db.from("invoices").insert(invoiceRows).select("id, total, status, issued_at, number");
  if (invErr) throw new Error(`invoices: ${invErr.message}`);
  console.log(`   ✓ ${invoices.length} invoices`);

  const lineItems = invoices
    .filter((inv) => inv.status === "paid")
    .map((inv, i) => ({
      org_id: org.id, invoice_id: inv.id,
      description: invoicePlans[i]?.description ?? "Detailing service",
      quantity: 1, unit_price: Number(inv.total), amount: Number(inv.total),
    }));
  if (lineItems.length) {
    const { error: liErr } = await db.from("invoice_line_items").insert(lineItems);
    if (liErr) throw new Error(`line items: ${liErr.message}`);
    console.log(`   ✓ ${lineItems.length} line items`);
  }

  // ---- 7. Leads (only if migration 026 has been applied) ------------------
  if (leadsTableExists) {
    const SOURCES = ["instagram", "google", "referral", "facebook", "website", "walk_in"];
    const STATUSES = ["new", "new", "contacted", "quote_sent", "scheduled", "won", "lost"];
    const leadRows = [];
    for (let i = 0; i < 14; i++) {
      const name = `${pick(FIRST, i * 3 + 5)} ${pick(LAST, i * 5 + 1)}`;
      const [make, model] = pick(MAKES, i * 3);
      leadRows.push({
        org_id: org.id, name,
        phone: `(${[214, 469, 972][i % 3]}) 555-02${String(10 + i).slice(-2)}`,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        vehicle: `${2018 + (i % 8)} ${make} ${model}`,
        service: pick(["Full detail", "Ceramic coating", "Interior deep clean", "Paint correction", "Maintenance wash"], i),
        estimated_value: [180, 265, 320, 450, 900, 120, 95][i % 7],
        source: pick(SOURCES, i), status: pick(STATUSES, i),
        notes: "[DEMO] Seeded sample lead.",
        last_contacted_at: i % 3 === 0 ? null : at(Y, M, Math.max(today - (i % 10), 1), 12),
        created_at: at(Y, M, Math.max(today - (i % 18), 1), 9),
      });
    }
    const { data: leads, error: leadErr } = await db.from("leads").insert(leadRows).select("id");
    if (leadErr) console.log(`   ⚠ leads skipped: ${leadErr.message}`);
    else console.log(`   ✓ ${leads.length} leads`);
  } else {
    console.log("   ⚠ leads table not found — run migration 026 to seed leads too");
  }

  // ---- 8. Make sure every feature is unlocked (Team plan) -----------------
  const { data: sub } = await db.from("subscriptions").select("id, plan").eq("org_id", org.id).maybeSingle();
  if (sub && sub.plan !== "team") {
    const { error } = await db.from("subscriptions").update({ plan: "team" }).eq("org_id", org.id);
    console.log(error ? `   ⚠ plan unchanged: ${error.message}` : `   ✓ plan ${sub.plan} → team (all features unlocked)`);
  } else if (sub) {
    console.log("   ✓ plan already team");
  }

  // ---- 9. Verify ----------------------------------------------------------
  const monthStart = new Date(Y, M, 1);
  const { data: allInv } = await db
    .from("invoices").select("total, deposit_amount, status, issued_at").eq("org_id", org.id);
  const collectedIn = (from, to) =>
    (allInv ?? []).reduce((s, i) => {
      const t = new Date(i.issued_at);
      if (t < from || (to && t >= to)) return s;
      return s + (i.status === "paid" ? Number(i.total) : i.status === "deposit_paid" ? Number(i.deposit_amount) : 0);
    }, 0);

  const thisMonth = money(collectedIn(monthStart, null));
  console.log("\n📊 Result");
  console.log(`   Customers ............ ${customers.length}`);
  console.log(`   Appointments ......... ${appts.length}`);
  console.log(`   Invoices ............. ${invoices.length}`);
  console.log(`   Revenue this month ... $${thisMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  for (const { offset } of history.slice(0, 5)) {
    const from = new Date(Y, M - offset, 1);
    const to = new Date(Y, M - offset + 1, 1);
    console.log(`   ${from.toLocaleString(undefined, { month: "short", year: "numeric" })} ............... $${money(collectedIn(from, to)).toLocaleString()}`);
  }

  if (Math.abs(thisMonth - MONTH_TARGET) > 0.009) {
    console.log(`\n⚠ This month is $${thisMonth} but the target was $${MONTH_TARGET}.`);
    console.log("   (Non-demo invoices in this month also count toward the total.)");
  } else {
    console.log(`\n✅ This month's revenue is exactly $${MONTH_TARGET.toLocaleString()}.`);
  }
  console.log("\nTo remove later: delete customers where org_id='" + org.id + "' and email like '%@example.com';");
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e.message);
  process.exit(1);
});

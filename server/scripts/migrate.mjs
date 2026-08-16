/**
 * Database migration runner for Detail Support.
 *
 * Applies the SQL files in `server/db/` (schema.sql, then every NNN_*.sql in
 * numeric order) against your Postgres database, tracking what's been applied in
 * a `public.schema_migrations` table so each file runs exactly once. Each file
 * runs in its own transaction — a failure rolls that file back and stops, so the
 * database is never left half-migrated.
 *
 *   cd server
 *   npm run db:migrate            # apply every pending migration, in order
 *   npm run db:migrate:status     # list applied vs pending (no changes)
 *
 *   # Adopting the runner on a database you already set up by hand: record the
 *   # files you've already run as applied, WITHOUT re-running them, then migrate
 *   # the rest. (Marks schema.sql … the named file as applied.)
 *   node scripts/migrate.mjs --baseline 027_customer_referral.sql
 *   npm run db:migrate            # now applies only 028, 029, …
 *
 * Requires DATABASE_URL in server/.env — see .env.example. Use the Direct
 * connection or the Session pooler string from Supabase, NOT the Transaction
 * pooler (it can't run multi-statement migration transactions).
 */
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const DB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "db");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "❌ DATABASE_URL is not set in server/.env\n" +
    "   Supabase → Project Settings → Database → Connection string → \"URI\"\n" +
    "   (choose \"Direct connection\" or \"Session pooler\", not \"Transaction pooler\").\n" +
    "   e.g. DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const statusOnly = args.includes("--status");
const baselineIdx = args.indexOf("--baseline");
const baselineThrough = baselineIdx >= 0 ? args[baselineIdx + 1] : null;

/** Ordered migrations: schema.sql first, then every NNN_*.sql ascending. */
async function migrationFiles() {
  const all = await readdir(DB_DIR);
  const numbered = all
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return [...(all.includes("schema.sql") ? ["schema.sql"] : []), ...numbered];
}

const esc = (s) => s.replace(/'/g, "''");
const isLocal = /@(localhost|127\.0\.0\.1)/.test(url);
const client = new pg.Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function main() {
  const files = await migrationFiles();
  await client.connect();
  try {
    // Tracking table. RLS on with no policies keeps it out of the public API;
    // the migration role (table owner) bypasses RLS, same as the SQL editor.
    await client.query(
      "create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());" +
      "alter table public.schema_migrations enable row level security;"
    );
    const { rows } = await client.query("select name from public.schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    if (statusOnly) {
      console.log("Migrations  (● applied  ○ pending)\n");
      for (const f of files) console.log(`  ${applied.has(f) ? "●" : "○"} ${f}`);
      const pending = files.filter((f) => !applied.has(f));
      console.log(`\n${applied.size} applied, ${pending.length} pending.`);
      return;
    }

    if (baselineThrough !== null) {
      if (!baselineThrough || !files.includes(baselineThrough)) {
        console.error(`❌ --baseline needs a migration filename that exists. Run "npm run db:migrate:status" to see them.`);
        process.exit(1);
      }
      const through = files.slice(0, files.indexOf(baselineThrough) + 1).filter((f) => !applied.has(f));
      if (through.length === 0) { console.log("Nothing to baseline — those files are already recorded."); return; }
      for (const f of through) {
        await client.query(`insert into public.schema_migrations (name) values ('${esc(f)}') on conflict (name) do nothing`);
      }
      console.log(`✓ Baselined ${through.length} file(s) as applied (through ${baselineThrough}), without running them:`);
      through.forEach((f) => console.log(`    ${f}`));
      console.log(`\nNow run "npm run db:migrate" to apply anything newer.`);
      return;
    }

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) { console.log("✓ Database is up to date — no pending migrations."); return; }

    console.log(`Applying ${pending.length} migration(s):\n`);
    for (const f of pending) {
      process.stdout.write(`  → ${f} … `);
      const sql = await readFile(join(DB_DIR, f), "utf8");
      try {
        // The whole file runs as one implicit transaction (simple query
        // protocol); the tracking insert is appended so recording is atomic
        // with the migration.
        await client.query(`${sql}\n;\ninsert into public.schema_migrations (name) values ('${esc(f)}') on conflict (name) do nothing;`);
        console.log("done");
      } catch (e) {
        console.log("FAILED");
        console.error(`\n❌ ${f} failed and was rolled back:\n   ${e.message}\n`);
        console.error("No further migrations were applied. Fix the cause and re-run — already-applied files are skipped.");
        process.exit(1);
      }
    }
    console.log(`\n✓ Applied ${pending.length} migration(s). Database is up to date.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

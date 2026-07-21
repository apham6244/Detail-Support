import cron from "node-cron";
import { env } from "../config/env";
import { serviceClient } from "../config/supabase";
import { runDueReminders } from "../services/notify.service";

/**
 * Ticks every minute and drains any reminders that have come due.
 *
 * Safety comes from the database, not from this loop: claim_due_reminders()
 * atomically moves rows pending -> sending, so overlapping ticks, a restart
 * mid-send, or a second instance can't double-send. That also means this is
 * safe to run repeatedly — a tick with nothing due does nothing.
 *
 * Without a service-role key there's no credential a session-less worker could
 * use, so the scheduler stays off and reminders remain manual ("Send now").
 */
let running = false;

export function startReminderScheduler() {
  if (!serviceClient()) {
    console.log("⏰ Reminder scheduler off — set SUPABASE_SERVICE_ROLE_KEY to enable automatic sends.");
    return;
  }

  cron.schedule("* * * * *", async () => {
    if (running) return; // never overlap ticks
    running = true;
    try {
      const r = await runDueReminders(25);
      if (r.ran && r.claimed > 0) {
        console.log(`⏰ Reminders: claimed ${r.claimed}, sent ${r.sent}, failed ${r.failed}`);
      }
    } catch (e) {
      console.error("⏰ Reminder scheduler tick failed:", (e as Error).message);
    } finally {
      running = false;
    }
  });

  console.log(`⏰ Reminder scheduler on (every minute) · email=${env.EMAIL_PROVIDER} sms=${env.SMS_PROVIDER}`);
}

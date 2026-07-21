import { createApp } from "./app";
import { env } from "./config/env";
import { startReminderScheduler } from "./jobs/reminderScheduler";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(
    `🚗 Detail Support API running on http://localhost:${env.PORT} (${env.NODE_ENV})`
  );
  console.log(`✉  Email: ${env.EMAIL_PROVIDER}${env.emailLive ? "" : " (logs only)"} · 💬 SMS: ${env.SMS_PROVIDER}${env.smsLive ? "" : " (logs only)"}`);
  startReminderScheduler();
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down.`);
  server.close(() => process.exit(0));
  // Force-exit if connections linger.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

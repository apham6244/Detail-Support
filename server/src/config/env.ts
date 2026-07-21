import "dotenv/config";
import { z } from "zod";

/**
 * Validate environment variables once, at startup. If anything required is
 * missing or malformed we exit immediately with a readable message rather
 * than failing deep inside a request later.
 */
const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4000),
    CORS_ORIGINS: z.string().default("http://localhost:5173"),
    APP_URL: z.string().url().default("http://localhost:5173"),
    SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
    SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
    // Intentionally NOT required: this server never bypasses RLS. Kept
    // optional only so existing deploy configs don't fail validation.
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    // ── Email ─────────────────────────────────────────────────────────────
    // "console" logs emails instead of sending — lets the system run with no
    // provider credentials. Switch to "sendgrid" to send for real.
    EMAIL_PROVIDER: z.enum(["console", "sendgrid"]).default("console"),
    EMAIL_FROM: z.string().email().default("hello@detailsupport.app"),
    EMAIL_FROM_NAME: z.string().default("Detail Support"),
    SENDGRID_API_KEY: z.string().optional(),

    // ── SMS ───────────────────────────────────────────────────────────────
    // "console" logs texts instead of sending — same shape as email, so the
    // system runs end-to-end with no provider credentials.
    SMS_PROVIDER: z.enum(["console", "twilio"]).default("console"),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM: z.string().optional(),

    // ── Stripe ────────────────────────────────────────────────────────────
    // All optional: with no key, billing routes report "not configured" and
    // the app keeps working on the manual plan switcher (see 024).
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // ── AI (Anthropic) ────────────────────────────────────────────────────
    // Powers the Gear Assistant. Optional: without a key the assistant route
    // reports "not configured" and the UI hides the feature. Get one at
    // https://console.anthropic.com.
    ANTHROPIC_API_KEY: z.string().optional(),

    // ── Google reviews ────────────────────────────────────────────────────
    // Powers the Reviews page (Google Places API). Optional: without a key the
    // Reviews route reports "not configured" and the UI explains the setup
    // instead of showing anything fabricated. Enable "Places API (New)" in a
    // Google Cloud project and create an API key.
    //
    // NOTE: Places returns the overall rating + total review count (both
    // authoritative) but at most 5 reviews and no owner responses. Full review
    // history + owner replies require the Business Profile API (OAuth + Google
    // approval) — see googleReviews.service.ts for where that provider slots in.
    GOOGLE_PLACES_API_KEY: z.string().optional(),
  })
  .refine((v) => !v.STRIPE_SECRET_KEY || !!v.STRIPE_WEBHOOK_SECRET, {
    // Checkout without a verified webhook is the worst possible state: Stripe
    // takes the customer's money and nothing ever upgrades their plan. Refuse
    // to start rather than sell something we won't deliver.
    message:
      "STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set — without it, payments succeed but plans never activate",
    path: ["STRIPE_WEBHOOK_SECRET"],
  })
  .refine((v) => !v.STRIPE_SECRET_KEY?.startsWith("sk_live_") || v.NODE_ENV === "production", {
    message:
      "Refusing to use a LIVE Stripe key outside production. Use a sk_test_ key for development.",
    path: ["STRIPE_SECRET_KEY"],
  })
  .refine((v) => v.EMAIL_PROVIDER !== "sendgrid" || !!v.SENDGRID_API_KEY, {
    message: "SENDGRID_API_KEY is required when EMAIL_PROVIDER=sendgrid",
    path: ["SENDGRID_API_KEY"],
  })
  .refine(
    (v) =>
      v.SMS_PROVIDER !== "twilio" ||
      (!!v.TWILIO_ACCOUNT_SID && !!v.TWILIO_AUTH_TOKEN && !!v.TWILIO_FROM),
    {
      message: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are required when SMS_PROVIDER=twilio",
      path: ["TWILIO_ACCOUNT_SID"],
    }
  );

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  isProd: data.NODE_ENV === "production",
  corsOrigins: data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  /** True once a real provider is configured — the UI uses this to stop
   *  telling people to copy links around. */
  emailLive: data.EMAIL_PROVIDER !== "console",
  smsLive: data.SMS_PROVIDER !== "console",
  /** True once Stripe can actually charge a card. */
  billingLive: Boolean(data.STRIPE_SECRET_KEY),
  /** Test vs live mode, for the UI to badge honestly. */
  billingTestMode: !data.STRIPE_SECRET_KEY?.startsWith("sk_live_"),
  /** True once the AI Gear Assistant has a key to call Claude with. */
  aiLive: Boolean(data.ANTHROPIC_API_KEY),
  /** True once Google reviews can actually be fetched. */
  googleReviewsLive: Boolean(data.GOOGLE_PLACES_API_KEY),
};

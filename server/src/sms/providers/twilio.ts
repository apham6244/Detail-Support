import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import type { OutboundSms, SmsProvider, SmsResult } from "../SmsProvider";

/**
 * Twilio via its REST API — no SDK, just a form-encoded POST, so the server
 * stays dependency-light. Credentials never leave the server.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";

  async send(sms: OutboundSms): Promise<SmsResult> {
    const sid = env.TWILIO_ACCOUNT_SID!;
    const auth = Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

    const body = new URLSearchParams({
      To: sms.to,
      From: env.TWILIO_FROM!,
      Body: sms.body,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) {
      // Surface Twilio's own message — it's usually actionable (bad number,
      // unverified sender, insufficient funds).
      throw new ApiError(502, `SMS failed: ${json.message ?? res.statusText}`);
    }
    return { providerMessageId: json.sid ?? null };
  }
}

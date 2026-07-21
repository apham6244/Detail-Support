import type { OutboundSms, SmsProvider, SmsResult } from "../SmsProvider";

/**
 * Logs the text instead of sending it. This is the default so the whole
 * notification path runs end-to-end with no Twilio account — the message is
 * fully rendered and authorised, it just lands in the server log.
 */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";

  async send(sms: OutboundSms): Promise<SmsResult> {
    console.log("\n──────── SMS (console) ────────");
    console.log(`To:   ${sms.to}`);
    if (sms.reference) console.log(`Ref:  ${sms.reference}`);
    console.log(`Body: ${sms.body}`);
    console.log("───────────────────────────────\n");
    return { providerMessageId: `console-${Date.now()}` };
  }
}

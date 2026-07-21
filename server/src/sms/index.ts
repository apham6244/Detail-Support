import { env } from "../config/env";
import type { SmsProvider } from "./SmsProvider";
import { ConsoleSmsProvider } from "./providers/console";
import { TwilioSmsProvider } from "./providers/twilio";

let provider: SmsProvider | null = null;

/** Lazily construct the configured provider (singleton). */
export function getSmsProvider(): SmsProvider {
  if (provider) return provider;
  provider = env.SMS_PROVIDER === "twilio" ? new TwilioSmsProvider() : new ConsoleSmsProvider();
  return provider;
}

export type { SmsProvider, OutboundSms } from "./SmsProvider";

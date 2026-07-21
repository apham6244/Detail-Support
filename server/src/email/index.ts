import { env } from "../config/env";
import type { EmailProvider } from "./EmailProvider";
import { ConsoleProvider } from "./providers/console";
import { SendGridProvider } from "./providers/sendgrid";

let provider: EmailProvider | null = null;

/** Lazily construct the configured provider (singleton). */
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  provider =
    env.EMAIL_PROVIDER === "sendgrid"
      ? new SendGridProvider()
      : new ConsoleProvider();
  return provider;
}

export type { EmailProvider, OutboundEmail } from "./EmailProvider";

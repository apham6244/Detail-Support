import { randomUUID } from "node:crypto";
import type { EmailProvider, OutboundEmail, SendResult } from "../EmailProvider";

/**
 * Development provider — prints the email instead of sending it, and returns a
 * synthetic message id. Lets the entire campaign/send pipeline run end-to-end
 * with no provider account. Never used when EMAIL_PROVIDER=sendgrid.
 */
export class ConsoleProvider implements EmailProvider {
  readonly name = "console";

  async send(email: OutboundEmail): Promise<SendResult> {
    const id = `console-${randomUUID()}`;
    console.log(
      [
        "",
        "──────────── ✉  EMAIL (console provider) ────────────",
        `To:      ${email.toName ? `${email.toName} <${email.to}>` : email.to}`,
        `Subject: ${email.subject}`,
        `Tags:    ${email.categories?.join(", ") ?? "-"}`,
        "----------------------------------------------------",
        email.text,
        "────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return { providerMessageId: id };
  }
}

import sgMail from "@sendgrid/mail";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import type { EmailProvider, OutboundEmail, SendResult } from "../EmailProvider";

/**
 * SendGrid provider. Enables open + click tracking so the event webhook
 * receives delivery/open/click events. custom_args are echoed back on every
 * event, letting a webhook tie an event back to the record that sent it.
 */
export class SendGridProvider implements EmailProvider {
  readonly name = "sendgrid";

  constructor() {
    if (!env.SENDGRID_API_KEY) {
      throw ApiError.internal("SENDGRID_API_KEY is not configured");
    }
    sgMail.setApiKey(env.SENDGRID_API_KEY);
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    try {
      const [res] = await sgMail.send({
        to: email.toName ? { email: email.to, name: email.toName } : email.to,
        from: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
        subject: email.subject,
        text: email.text,
        html: email.html,
        customArgs: email.customArgs,
        categories: email.categories,
        trackingSettings: {
          openTracking: { enable: true },
          clickTracking: { enable: true, enableText: false },
        },
        mailSettings: { sandboxMode: { enable: false } },
      });

      const messageId =
        (res?.headers?.["x-message-id"] as string | undefined) ?? null;
      return { providerMessageId: messageId };
    } catch (err: any) {
      // Surface SendGrid's structured error without leaking the API key.
      const detail =
        err?.response?.body?.errors?.[0]?.message ?? err?.message ?? "send failed";
      throw new ApiError(502, `SendGrid error: ${detail}`);
    }
  }
}

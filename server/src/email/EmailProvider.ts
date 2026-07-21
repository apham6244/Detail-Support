/** A fully-rendered email ready to hand to a provider. */
export interface OutboundEmail {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  /** Echoed back on tracking events so a send can be tied to its origin record. */
  customArgs?: Record<string, string>;
  /** Provider "category"/tag — we use the campaign id for grouping. */
  categories?: string[];
}

export interface SendResult {
  providerMessageId: string | null;
}

export interface EmailProvider {
  readonly name: string;
  send(email: OutboundEmail): Promise<SendResult>;
}

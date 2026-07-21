/** A fully-rendered text message ready to hand to a provider. */
export interface OutboundSms {
  to: string;
  body: string;
  /** Echoed back on delivery callbacks so a send can be tied to its origin. */
  reference?: string;
}

export interface SmsResult {
  providerMessageId: string | null;
}

export interface SmsProvider {
  readonly name: string;
  send(sms: OutboundSms): Promise<SmsResult>;
}

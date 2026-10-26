export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Outbound transactional email. Implementations must reject rather than resolve on
 * delivery failure, so callers can roll back the work that depended on the message.
 */
export interface EmailSender {
  send(message: OutboundEmail): Promise<void>;
}

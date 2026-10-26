import type { EmailAuthConfig } from '../../modules/identity-access/email-auth.config';
import type { EmailSender } from '../../persistence/ports/email-sender.port';
import { SmtpEmailSender } from './smtp-email-sender';

export function createEmailSender(config: EmailAuthConfig): EmailSender {
  if (!config.smtp) {
    if (config.enabled) throw new Error('Real SMTP must be configured before enabling email OTP');
    return { send: async () => { throw new Error('Email OTP is disabled'); } };
  }
  return new SmtpEmailSender(config.smtp);
}

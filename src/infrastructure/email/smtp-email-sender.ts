import { createTransport, type Transporter } from 'nodemailer';

import type { EmailSender, OutboundEmail } from '../../persistence/ports/email-sender.port';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export function readSmtpSettings(env: NodeJS.ProcessEnv): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;
  const from = env.SMTP_FROM?.trim() || user;
  const port = Number(env.SMTP_PORT?.trim() || '587');
  if (!host || !user || !password || !from || !Number.isInteger(port) || port < 1 || port > 65535)
    return null;
  return { host, port, secure: port === 465, user, password, from };
}

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    this.transporter = createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.password },
    });
  }

  async send(message: OutboundEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.settings.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

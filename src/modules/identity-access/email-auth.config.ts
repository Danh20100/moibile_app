import { readSmtpSettings, type SmtpSettings } from '../../infrastructure/email/smtp-email-sender';

export const EMAIL_AUTH_CONFIG = Symbol('EMAIL_AUTH_CONFIG');

export const OTP_CODE_LENGTH = 6;
export const OTP_LIFETIME_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_SETTLED_RETENTION_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface EmailAuthConfig {
  enabled: boolean;
  otpHmacSecret: string;
  smtp: SmtpSettings | null;
}

/**
 * Reads email-authentication settings once at startup and refuses to boot on a
 * combination that would be unsafe in production, rather than failing per request.
 */
export function readEmailAuthConfig(env: NodeJS.ProcessEnv): EmailAuthConfig {
  const otpHmacSecret = env.TROOI_OTP_HMAC_SECRET?.trim() ?? '';
  const smtp = readSmtpSettings(env);
  const configured = Boolean(
    otpHmacSecret || env.SMTP_HOST?.trim() || env.SMTP_USER?.trim() || env.SMTP_PASSWORD?.trim(),
  );

  if (configured) {
    if (otpHmacSecret.length < 32)
      throw new Error(
        'TROOI_OTP_HMAC_SECRET must be at least 32 characters',
      );
    // The console sender prints verification codes instead of delivering them, which would
    // hand every account to anyone who can read the logs.
    if (!smtp)
      throw new Error(
        'SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required for email OTP',
      );
    if (env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED?.trim() !== 'true')
      throw new Error(
        'TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED must be true when email OTP is configured',
      );
  }
  return { enabled: configured, otpHmacSecret, smtp };
}

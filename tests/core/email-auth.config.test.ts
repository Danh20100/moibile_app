import assert from 'node:assert/strict';
import test from 'node:test';

import { readEmailAuthConfig } from '../../src/modules/identity-access/email-auth.config';

const secret = 'x'.repeat(32);
const smtp = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_USER: 'sender@example.test',
  SMTP_PASSWORD: 'app-password',
  SMTP_FROM: 'sender@example.test',
};

test('email auth stays off without extra secrets when the flag is unset', () => {
  const config = readEmailAuthConfig({ NODE_ENV: 'development' });
  assert.equal(config.enabled, false);
  assert.equal(config.smtp, null);
});

test('enabling email auth requires a long HMAC secret', () => {
  assert.throws(
    () => readEmailAuthConfig({ TROOI_EMAIL_AUTH_ENABLED: 'true', TROOI_OTP_HMAC_SECRET: 'short' }),
    /TROOI_OTP_HMAC_SECRET/,
  );
});

test('production refuses the console sender when email auth is enabled', () => {
  assert.throws(
    () =>
      readEmailAuthConfig({
        NODE_ENV: 'production',
        TROOI_EMAIL_AUTH_ENABLED: 'true',
        TROOI_OTP_HMAC_SECRET: secret,
      }),
    /SMTP_HOST/,
  );
});

test('development also requires real SMTP when email OTP is enabled', () => {
  assert.throws(
    () => readEmailAuthConfig({ NODE_ENV: 'development', TROOI_EMAIL_AUTH_ENABLED: 'true', TROOI_OTP_HMAC_SECRET: secret }),
    /SMTP_HOST/,
  );
});

test('real SMTP can enable email OTP', () => {
  const production = readEmailAuthConfig({
    NODE_ENV: 'production',
    TROOI_EMAIL_AUTH_ENABLED: 'true',
    TROOI_OTP_HMAC_SECRET: secret,
    ...smtp,
  });
  assert.equal(production.enabled, true);
  assert.equal(production.smtp?.host, 'smtp.gmail.com');
});

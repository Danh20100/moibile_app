import assert from 'node:assert/strict';
import test from 'node:test';

import { readEmailAuthConfig } from '../../src/modules/identity-access/email-auth.config';

const secret = 'x'.repeat(32);
const smtp = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_USER: 'sender@example.test',
  SMTP_PASSWORD: 'app-password',
};

test('OTP stays off when SMTP credentials and HMAC secret are absent', () => {
  for (const env of [{}, { SMTP_PORT: '587', SMTP_FROM: 'sender@example.test' }]) {
    const config = readEmailAuthConfig(env);
    assert.equal(config.enabled, false);
    assert.equal(config.smtp, null);
  }
});

test('complete SMTP and HMAC settings enable OTP with defaults', () => {
  const config = readEmailAuthConfig({
    ...smtp,
    TROOI_OTP_HMAC_SECRET: secret,
    TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED: 'true',
  });
  assert.equal(config.enabled, true);
  assert.equal(config.smtp?.host, 'smtp.gmail.com');
  assert.equal(config.smtp?.port, 587);
  assert.equal(config.smtp?.from, smtp.SMTP_USER);
});

test('partial or invalid OTP settings fail startup', () => {
  for (const env of [
    { TROOI_OTP_HMAC_SECRET: secret },
    { ...smtp },
    { ...smtp, TROOI_OTP_HMAC_SECRET: 'short' },
    { SMTP_HOST: 'smtp.gmail.com' },
    { ...smtp, TROOI_OTP_HMAC_SECRET: secret, SMTP_PASSWORD: '  ' },
    { ...smtp, TROOI_OTP_HMAC_SECRET: secret, SMTP_PORT: '0' },
    { ...smtp, TROOI_OTP_HMAC_SECRET: secret, SMTP_PORT: '65536' },
    { ...smtp, TROOI_OTP_HMAC_SECRET: secret, SMTP_PORT: '0x24b' },
  ]) {
    assert.throws(() => readEmailAuthConfig(env));
  }
});

test('OTP requires the identity foundation gate to remain enabled', () => {
  assert.throws(() => readEmailAuthConfig({
    ...smtp,
    TROOI_OTP_HMAC_SECRET: secret,
    TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED: 'false',
  }), /TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED/);
  assert.throws(() => readEmailAuthConfig({ ...smtp, TROOI_OTP_HMAC_SECRET: secret }),
    /TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED/);
});

test('nondefault SMTP sender and port stay explicit', () => {
  const config = readEmailAuthConfig({
    ...smtp,
    SMTP_PORT: '465',
    SMTP_FROM: 'TrọƠi <sender@example.test>',
    TROOI_OTP_HMAC_SECRET: secret,
    TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED: 'true',
  });
  assert.equal(config.smtp?.secure, true);
  assert.equal(config.smtp?.from, 'TrọƠi <sender@example.test>');
});

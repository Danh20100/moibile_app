import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';

import { SmtpEmailSender, readSmtpSettings } from '../../src/infrastructure/email/smtp-email-sender';

const settings = { host: 'smtp.example.test', port: 587, secure: false,
  user: 'sender@example.test', password: 'test-password', from: 'sender@example.test' };
const message = { to: 'recipient@example.test', subject: 'Code', text: '123456', html: '<p>123456</p>' };

test('SMTP delivery requires encryption and finite transport deadlines', async (t) => {
  let options: Record<string, unknown> = {};
  t.mock.method(nodemailer, 'createTransport', (input: Record<string, unknown>) => {
    options = input;
    return { sendMail: async () => ({ accepted: ['recipient@example.test'], rejected: [] }) };
  });
  await new SmtpEmailSender(settings).send(message);
  assert.equal(options.requireTLS, true);
  for (const name of ['connectionTimeout', 'greetingTimeout', 'socketTimeout']) {
    assert.equal(typeof options[name], 'number');
    assert.ok((options[name] as number) > 0 && (options[name] as number) <= 30_000);
  }
});

test('SMTP rejection cannot be reported as delivered', async (t) => {
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async () => ({ accepted: [], rejected: ['recipient@example.test'] }),
  }));
  await assert.rejects(new SmtpEmailSender(settings).send(message), /recipient/i);
});

test('SMTP configuration rejects whitespace credentials and nondecimal ports', () => {
  const env = { SMTP_HOST: settings.host, SMTP_USER: settings.user, SMTP_PASSWORD: '   ', SMTP_PORT: '587' };
  assert.equal(readSmtpSettings(env), null);
  for (const port of ['0x24b', '5.87e2', '+587'])
    assert.equal(readSmtpSettings({ ...env, SMTP_PASSWORD: 'password', SMTP_PORT: port }), null);
});

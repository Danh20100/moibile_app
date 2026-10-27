import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = (file: string) => readFileSync(`database/migrations/sql/${file}`, 'utf8');

test('000027 adds contact fields and constraints without modifying existing profile data', () => {
  const up = sql('000027_profile_contact.up.sql');
  const down = sql('000027_profile_contact.down.sql');
  assert.match(up, /ADD COLUMN phone_number/);
  assert.match(up, /ADD COLUMN residential_address/);
  assert.doesNotMatch(up, /\b(DROP|TRUNCATE|DELETE|UPDATE)\b/i);
  assert.match(down, /IF EXISTS \(SELECT 1 FROM user_profiles WHERE phone_number IS NOT NULL OR residential_address IS NOT NULL\)/);
  assert.match(down, /RAISE EXCEPTION/);
});

test('000028 scopes email OTP to the authenticated identity snapshot and refuses destructive rollback', () => {
  const up = sql('000028_email_change_otp.up.sql');
  const down = sql('000028_email_change_otp.down.sql');
  assert.match(up, /change_user_id uuid REFERENCES users/);
  assert.match(up, /change_session_id uuid REFERENCES auth_sessions/);
  assert.match(up, /change_email_revision bigint/);
  assert.match(up, /purpose = 'EMAIL_CHANGE'.*change_user_id IS NOT NULL/s);
  assert.match(up, /'EMAIL_CHANGED'/);
  assert.doesNotMatch(up, /^\s*(TRUNCATE|DELETE\s+FROM|UPDATE\s+\w+)/im);
  assert.match(down, /WHERE purpose = 'EMAIL_CHANGE'/);
  assert.match(down, /WHERE event_code = 'EMAIL_CHANGED'/);
  assert.match(down, /RAISE EXCEPTION/);
});


test('000029 enforces ordered email-change stages and refuses rollback after use', () => {
  const up = sql('000029_dual_email_change_otp.up.sql');
  const down = sql('000029_dual_email_change_otp.down.sql');
  assert.ok(up.includes('ADD COLUMN change_stage'));
  assert.ok(up.includes('ADD COLUMN change_target_address'));
  assert.ok(up.includes('ADD COLUMN change_target_normalized'));
  assert.match(up, /UPDATE identity_otp_challenges\r?\n\s*SET superseded_at/);
  assert.match(up, /purpose = 'EMAIL_CHANGE'\r?\n\s*AND consumed_at IS NULL\r?\n\s*AND superseded_at IS NULL/);
  assert.ok(up.includes("change_stage IN ('CURRENT_EMAIL', 'NEW_EMAIL')"));
  assert.ok(up.includes('CREATE UNIQUE INDEX uq_identity_otp_challenges_live_email_change_user'));
  assert.ok(up.includes('consumed_at IS NULL AND superseded_at IS NULL'));
  assert.ok(up.includes("'EMAIL_CHANGE_NOTICE_FAILED'"));
  assert.equal(/\b(TRUNCATE|DELETE\s+FROM|DROP\s+TABLE)\b/i.test(up), false);
  assert.ok(down.includes('change_stage IS NOT NULL'));
  assert.ok(down.includes('EMAIL_CHANGE_NOTICE_FAILED'));
  assert.ok(down.includes('RAISE EXCEPTION'));
});

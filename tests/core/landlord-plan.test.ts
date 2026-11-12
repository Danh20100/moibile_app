import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { planValidUntil } from '../../src/modules/payment-gateway/services/plan-checkout.service';
import { resetTestEmail } from '../../src/modules/identity-access/services/reset-test-user';

test('landlord plan lasts one month at 49000 VND', () => {
  assert.equal(planValidUntil('2026-10-15T03:00:00.000Z'), '2026-11-15T03:00:00.000Z');
  const sql = readFileSync('database/migrations/sql/000030_owner_plan_entitlements.up.sql', 'utf8');
  assert.match(sql, /49000\.00/);
  assert.match(sql, /PLAN %/);
});

test('reset test account is env-only and keeps the user row', () => {
  assert.equal(resetTestEmail({}), null);
  assert.equal(resetTestEmail({ TROOI_RESET_TEST_EMAIL: 'Test01@Trooi.com', TROOI_RESET_TEST_PASSWORD: 'x' }), 'test01@trooi.com');
  const sql = readFileSync('database/migrations/sql/000031_reset_owner_work.up.sql', 'utf8');
  assert.match(sql, /DELETE FROM organizations/);
  assert.match(sql, /DELETE FROM owner_plan_checkouts/);
  assert.doesNotMatch(sql, /DELETE FROM users/);
});

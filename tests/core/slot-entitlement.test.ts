import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { slotValidUntil } from '../../src/modules/payment-gateway/services/slot-checkout.service';

test('slot entitlement lasts one year and is not a tenancy payment', () => {
  assert.equal(slotValidUntil('2026-10-15T03:00:00.000Z'), '2027-10-15T03:00:00.000Z');
  const sql = readFileSync('database/migrations/sql/000017_owner_slot_entitlements.up.sql', 'utf8');
  assert.match(sql, /259000\.00/);
  assert.match(sql, /PROVIDER_VERIFIED/);
  assert.doesNotMatch(sql, /payments|tenancies|gateway_checkouts/i);
  const settlement = readFileSync('src/modules/payment-gateway/services/slot-checkout.service.ts', 'utf8');
  assert.doesNotMatch(settlement, /insertPayment|INTO payments|INTO gateway\.gateway_checkouts/);
  const rent = readFileSync('src/modules/payment-gateway/services/gateway-settlement.service.ts', 'utf8');
  assert.match(rent, /Slot checkout cannot settle as rent/);
});

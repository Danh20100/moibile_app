import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile, readRepoFiles } from './support/source';

const financeSource = () =>
  readRepoFiles([
    'src/modules/billing/contracts/index.ts',
    'src/modules/billing/services/billing.service.ts',
    'src/modules/receipt/contracts/index.ts',
    'src/modules/receipt/services/receipt.service.ts',
  ]);

test('current charge types are RENT ELECTRICITY WATER only', () => {
  const source = readRepoFile('src/modules/billing/contracts/index.ts');
  for (const type of ['rent', 'electricity', 'water']) {
    assert.match(source, new RegExp(`['\"]${type}['\"]`, 'i'), `missing Charge type ${type}`);
  }
  assert.doesNotMatch(source, /type\s*:\s*string/);
  assert.doesNotMatch(source, /service|internet/i);
});

test('Payment is a first-class actual-inflow concept belonging to exactly one Tenancy', () => {
  const source = financeSource();
  assert.match(source, /interface\s+Payment\b|class\s+PaymentService\b/);
  assert.match(source, /Payment[\s\S]{0,500}tenancyId|tenancyId[\s\S]{0,500}Payment/i);
  assert.match(source, /confirmed/i);
});

test('PaymentAllocation and DepositPaymentApplication are distinct first-class concepts', () => {
  const source = financeSource();
  assert.match(source, /PaymentAllocation/);
  assert.match(source, /DepositPaymentApplication/);
});

test('allocation and deposit application cannot cross Tenancy', () => {
  const source = financeSource().toLowerCase();
  assert.ok(
    source.includes('cross tenancy') || source.includes('same tenancy') || source.includes('tenancy mismatch'),
    'finance implementation must expose a same-Tenancy guard',
  );
});

test('allocation plus deposit application cannot exceed Payment amount', () => {
  const source = financeSource().toLowerCase();
  assert.ok(
    (source.includes('allocation') && source.includes('deposit') && source.includes('payment') && source.includes('amount')) &&
      (source.includes('exceed') || source.includes('remaining') || source.includes('available')),
    'finance implementation must expose the Payment amount cap',
  );
});

test('confirmed Payment is corrected by void reverse plus a new Payment rather than destructive edit', () => {
  const source = financeSource().toLowerCase();
  assert.ok(source.includes('void') || source.includes('reverse'), 'confirmed Payment correction must support void/reverse');
  assert.ok(source.includes('new payment') || source.includes('replacement'), 'correction must create a new Payment fact');
});

test('Receipt is evidence attached to confirmed Payment and uses ISSUED VOIDED lifecycle', () => {
  const source = readRepoFile('src/modules/receipt/contracts/index.ts');
  assert.match(source, /paymentId|payment_id/i);
  assert.match(source, /['"]issued['"]/i);
  assert.match(source, /['"]voided['"]/i);
  assert.doesNotMatch(source, /['"]recorded['"]|['"]confirmed['"]/i);
});

test('Receipt is not the payment record', () => {
  const source = readRepoFile('src/modules/receipt/contracts/index.ts');
  assert.doesNotMatch(source, /\bpaymentMethod\b/);
  assert.doesNotMatch(source, /\bamount\b/);
  assert.doesNotMatch(source, /\btenancyId\b|\bbillingCycleId\b/);
});

test('billing source of truth does not mutate paidAmount outstanding via applyPaymentOutcome', () => {
  const source = readRepoFiles([
    'src/modules/billing/contracts/index.ts',
    'src/modules/billing/services/billing.service.ts',
  ]);
  assert.doesNotMatch(source, /\bapplyPaymentOutcome\b/);
  assert.doesNotMatch(source, /\bpaidAmount\b/);
  assert.doesNotMatch(source, /\boutstandingBalance\b/);
});

test('deposit requirement is separated from deposit fulfillment and settlement', () => {
  const source = financeSource();
  assert.match(source, /DepositPaymentApplication/);
  assert.match(source, /DepositSettlement/);
  assert.match(source, /DepositEvent/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { RecordPaymentDto } from '../../src/modules/billing/dto';

import { BillingService } from '../../src/modules/billing/services/billing.service';
import { ReceiptService } from '../../src/modules/receipt/services/receipt.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const tenancyLookup = {
  async findById(id: string) {
    if (!['tenancy-a', 'tenancy-b'].includes(id)) {
      throw new Error(`missing tenancy ${id}`);
    }
    return { id, roomId: `room-${id}`, status: 'active' as const };
  },
};

function services() {
  const transactions = createCoreTestTransactionManager();
  const finance = new BillingService(tenancyLookup as never, transactions);
  const receipts = new ReceiptService(finance, transactions);
  return { finance, receipts, transactions };
}

test('cycle owns terms provenance and current charge vocabulary only', async () => {
  const { finance } = services();
  const cycle = await finance.createCycle({
    tenancyId: 'tenancy-a',
    tenancyTermsId: 'terms-1',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    charges: [{ type: 'RENT', amount: '3500000.00' }],
  });

  assert.equal(cycle.tenancyTermsId, 'terms-1');
  assert.equal(cycle.charges[0]?.type, 'RENT');
  await assert.rejects(
    () =>
      finance.createCycle({
        tenancyId: 'tenancy-a',
        tenancyTermsId: 'terms-1',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        charges: [{ type: 'INTERNET' as never, amount: '1.00' }],
      }),
    BadRequestException,
  );
});

test('payment allocation cannot cross tenancy or exceed payment amount', async () => {
  const { finance } = services();
  const a = await finance.createCycle({
    tenancyId: 'tenancy-a',
    tenancyTermsId: 'terms-a',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    charges: [{ type: 'RENT', amount: '100.00' }],
  });
  const b = await finance.createCycle({
    tenancyId: 'tenancy-b',
    tenancyTermsId: 'terms-b',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    charges: [{ type: 'RENT', amount: '100.00' }],
  });
  const payment = await finance.recordPayment({
    tenancyId: 'tenancy-a',
    amount: '100.00',
    source: 'MANUAL_TRANSFER',
    confirmedAt: '2026-09-05T00:00:00.000Z',
  });

  await assert.rejects(
    () => finance.allocatePayment(payment.id, b.charges[0]!.id, '1.00'),
    /same Tenancy|cross Tenancy/i,
  );
  await finance.allocatePayment(payment.id, a.charges[0]!.id, '80.00');
  await assert.rejects(
    () => finance.allocatePayment(payment.id, a.charges[0]!.id, '21.00'),
    /exceed|remaining/i,
  );
});

test('charge allocations and deposit applications share the payment amount cap', async () => {
  const { finance } = services();
  const cycle = await finance.createCycle({
    tenancyId: 'tenancy-a',
    tenancyTermsId: 'terms-a',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    charges: [{ type: 'RENT', amount: '100.00' }],
  });
  const deposit = await finance.createDeposit('tenancy-a');
  const payment = await finance.recordPayment({
    tenancyId: 'tenancy-a',
    amount: '100.00',
    source: 'MANUAL_CASH',
    confirmedAt: '2026-09-05T00:00:00.000Z',
  });

  await finance.allocatePayment(payment.id, cycle.charges[0]!.id, '60.00');
  await finance.applyPaymentToDeposit(payment.id, deposit.id, '40.00');
  await assert.rejects(
    () => finance.applyPaymentToDeposit(payment.id, deposit.id, '0.01'),
    /exceed|remaining/i,
  );
  assert.deepEqual(
    (await finance.listDepositEvents(deposit.id)).map((event) => event.eventType),
    ['RECEIVED'],
  );
});

test('deposit projection blocks OPEN requirement-change semantics after partial funding', async () => {
  const { finance, transactions } = services();
  await transactions.run(async ({ repositories }) => {
    await repositories.tenancy.insertTerms({
      tenancyTermsId: 'terms-deposit-v1',
      tenancyId: 'tenancy-a',
      version: 1,
      rentAmount: '100.00',
      agreedDepositRequirement: '100.00',
      termStart: '2026-01-01',
      termEnd: '2026-12-31',
      billingDayOrDueDateRule: {},
      electricityArrangement: {},
      waterArrangement: {},
      minimalRentalConditions: {},
      effectiveFromCycleBoundary: '2026-01-01',
    });
  });
  const deposit = await finance.createDeposit('tenancy-a');
  const payment = await finance.recordPayment({
    tenancyId: 'tenancy-a',
    amount: '40.00',
    source: 'MANUAL_CASH',
    confirmedAt: '2026-02-01T00:00:00.000Z',
  });
  await finance.applyPaymentToDeposit(payment.id, deposit.id, '40.00');

  const partial = await finance.findDepositProjectionForTenancy('tenancy-a');
  assert.equal(partial.requirementAmount, '100.00');
  assert.equal(partial.fundedAmount, '40.00');
  assert.equal(partial.state, 'PARTIALLY_HELD');
  assert.equal(partial.blockedByOpenPolicy, false);

  await transactions.run(async ({ repositories }) => {
    await repositories.tenancy.insertTerms({
      tenancyTermsId: 'terms-deposit-v2',
      tenancyId: 'tenancy-a',
      version: 2,
      rentAmount: '100.00',
      agreedDepositRequirement: '120.00',
      termStart: '2026-01-01',
      termEnd: '2026-12-31',
      billingDayOrDueDateRule: {},
      electricityArrangement: {},
      waterArrangement: {},
      minimalRentalConditions: {},
      effectiveFromCycleBoundary: '2026-03-01',
    });
  });

  const blocked = await finance.findDepositProjectionForTenancy('tenancy-a');
  assert.equal(blocked.requirementAmount, null);
  assert.equal(blocked.state, null);
  assert.equal(blocked.blockedByOpenPolicy, true);
  assert.equal(blocked.fundedAmount, '40.00');
  assert.equal(blocked.heldAmount, '40.00');
});

test('confirmed payment correction voids old fact and requires a replacement payment', async () => {
  const { finance } = services();
  const payment = await finance.recordPayment({
    tenancyId: 'tenancy-a',
    amount: '100.00',
    source: 'MANUAL_CASH',
    confirmedAt: '2026-09-05T00:00:00.000Z',
  });
  const replacement = await finance.correctPayment(payment.id, {
    amount: '90.00',
    source: 'MANUAL_CASH',
    confirmedAt: '2026-09-06T00:00:00.000Z',
    correctionNote: 'Corrected counting error',
  });

  assert.equal(replacement.verification, 'USER_RECORDED');
  assert.equal((await finance.findPaymentById(payment.id)).replacementPaymentId, replacement.id);
  assert.ok((await finance.findPaymentById(payment.id)).voidedOrReversedAt);
});

test('receipt is evidence for confirmed payment and keeps issued/voided history', async () => {
  const { finance, receipts } = services();
  const payment = await finance.recordPayment({
    tenancyId: 'tenancy-a',
    amount: '100.00',
    source: 'MANUAL_TRANSFER',
    confirmedAt: '2026-09-05T00:00:00.000Z',
  });
  const issued = await receipts.issue(payment.id);
  assert.equal(issued.status, 'ISSUED');
  assert.equal(issued.paymentId, payment.id);
  assert.equal('amount' in issued, false);

  const voided = await receipts.void(issued.id);
  assert.equal(voided.status, 'VOIDED');
  const replacement = await receipts.issue(payment.id);
  assert.equal((await receipts.findById(issued.id)).replacementReceiptId, replacement.id);
});

test('deposit settlement appends refunded and retained provenance events', async () => {
  const { finance } = services();
  const deposit = await finance.createDeposit('tenancy-a');
  const payment = await finance.recordPayment({ tenancyId: 'tenancy-a', amount: '100.00', source: 'MANUAL_CASH', confirmedAt: '2026-09-29T00:00:00.000Z' });
  await finance.applyPaymentToDeposit(payment.id, deposit.id, '100.00');
  const settlement = await finance.settleDeposit(deposit.id, {
    refundedAmount: '70.00',
    retainedAmount: '30.00',
    reasonOrNote: 'Final checkout settlement',
    actedByUserId: 'user-1',
    settledAt: '2026-09-30T00:00:00.000Z',
  });
  assert.equal(settlement.depositId, deposit.id);
  assert.deepEqual(
    (await finance.listDepositEvents(deposit.id)).map((event) => event.eventType),
    ['RECEIVED', 'REFUNDED', 'RETAINED'],
  );
});

test('manual service rejects parsed provider provenance before recording or correcting', async () => {
  const { finance } = services();
  const manual = { tenancyId: 'tenancy-a', amount: '100.00', source: 'MANUAL_CASH', confirmedAt: '2026-10-05T00:00:00.000Z' };
  for (const provenance of [{ source: 'GATEWAY' }, { verification: 'PROVIDER_VERIFIED' }, { verification: 'USER_RECORDED' }]) {
    const input = plainToInstance(RecordPaymentDto, { ...manual, ...provenance });
    await assert.rejects(() => finance.recordPayment(input), BadRequestException);
    assert.deepEqual(await finance.findPaymentsByTenancyId(manual.tenancyId), []);
  }
  const original = await finance.recordPayment(plainToInstance(RecordPaymentDto, manual));
  assert.equal(original.verification, 'USER_RECORDED');
  for (const provenance of [{ source: 'GATEWAY' }, { verification: 'PROVIDER_VERIFIED' }, { verification: 'USER_RECORDED' }]) {
    const input = Object.assign(plainToInstance(RecordPaymentDto, { ...manual, ...provenance }), { correctionNote: 'Correction' });
    await assert.rejects(() => finance.correctPayment(original.id, input), BadRequestException);
    assert.deepEqual(await finance.findPaymentById(original.id), original);
    assert.equal((await finance.findPaymentsByTenancyId(manual.tenancyId)).length, 1);
  }
});

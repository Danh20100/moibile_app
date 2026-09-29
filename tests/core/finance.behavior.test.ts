import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { BillingService } from '../../src/modules/billing/services/billing.service';
import { ReceiptService } from '../../src/modules/receipt/services/receipt.service';

const tenancyLookup = {
  async findById(id: string) {
    if (!['tenancy-a', 'tenancy-b'].includes(id)) {
      throw new Error(`missing tenancy ${id}`);
    }
    return { id, roomId: `room-${id}`, status: 'active' as const };
  },
};

function services() {
  const finance = new BillingService(tenancyLookup as never);
  const receipts = new ReceiptService(finance);
  return { finance, receipts };
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
    verification: 'USER_RECORDED',
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
    verification: 'USER_RECORDED',
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

test('confirmed payment correction voids old fact and requires a replacement payment', async () => {
  const { finance } = services();
  const payment = await finance.recordPayment({
    tenancyId: 'tenancy-a',
    amount: '100.00',
    source: 'MANUAL_CASH',
    verification: 'USER_RECORDED',
    confirmedAt: '2026-09-05T00:00:00.000Z',
  });
  const replacement = await finance.correctPayment(payment.id, {
    amount: '90.00',
    source: 'MANUAL_CASH',
    verification: 'USER_RECORDED',
    confirmedAt: '2026-09-06T00:00:00.000Z',
    correctionNote: 'Corrected counting error',
  });

  assert.equal((await finance.findPaymentById(payment.id)).replacementPaymentId, replacement.id);
  assert.ok((await finance.findPaymentById(payment.id)).voidedOrReversedAt);
});

test('receipt is evidence for confirmed payment and keeps issued/voided history', async () => {
  const { finance, receipts } = services();
  const payment = await finance.recordPayment({
    tenancyId: 'tenancy-a',
    amount: '100.00',
    source: 'MANUAL_TRANSFER',
    verification: 'PROVIDER_VERIFIED',
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
    ['REFUNDED', 'RETAINED'],
  );
});

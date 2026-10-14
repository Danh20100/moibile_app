import assert from 'node:assert/strict';
import test from 'node:test';
import { financeFixture as F } from '../support/finance-fixtures';

import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { RecordPaymentDto } from '../../src/modules/billing/dto';

import { BillingService } from '../../src/modules/billing/services/billing.service';
import { ReceiptService } from '../../src/modules/receipt/services/receipt.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const tenancyLookup = {
  async findById(id: string) {
    const tenancy = F.tenancyLookup.find((value) => value.id === id);
    if (!tenancy) {
      throw new Error(`missing tenancy ${id}`);
    }
    return tenancy;
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
  const cycle = await finance.createCycle(F.values.scenario3);

  assert.equal(cycle.tenancyTermsId, F.values.scenario4);
  assert.equal(cycle.charges[0]?.type, F.values.scenario5);
  await assert.rejects(() => finance.createCycle(F.values.scenario6), BadRequestException);
});

test('BillingCycle due date clamps from its start month and unknown historical Terms stay null', async () => {
  const { finance, transactions } = services();
  await transactions.run(({ repositories }) => repositories.tenancy.insertTerms({
    tenancyTermsId: 'terms-due-day', tenancyId: 'tenancy-a', version: 2, rentAmount: '100.00',
    agreedDepositRequirement: '0.00', termStart: '2026-01-01', termEnd: '2100-01-01',
    billingDayOrDueDateRule: { day: 31 }, electricityArrangement: {}, waterArrangement: {},
    minimalRentalConditions: {}, effectiveFromCycleBoundary: '2026-01-01',
  }));
  const cycle = await finance.createCycle({ tenancyId: 'tenancy-a', tenancyTermsId: 'terms-due-day',
    periodStart: '2026-02-01', periodEnd: '2026-02-28', charges: [{ type: 'RENT', amount: '100.00' }] });
  assert.equal(cycle.dueDate, '2026-02-28');
  const legacy = await finance.createCycle({ ...F.values.scenario3, periodStart: '2026-03-01', periodEnd: '2026-03-31' });
  assert.equal(legacy.dueDate, null, 'unknown stored billing-day JSON does not infer a date');
  const malformed = await finance.createCycle({ ...F.values.scenario3, periodStart: '2026-04-99', periodEnd: '2026-04-99' });
  assert.equal(malformed.dueDate, null, 'invalid calendar dates do not produce due dates');
  assert.deepEqual(await finance.findPaymentsByTenancyId('tenancy-a'), [], 'due-date projection creates no Payment');
});

test('payment allocation cannot cross tenancy or exceed payment amount', async () => {
  const { finance } = services();
  const a = await finance.createCycle(F.values.scenario7);
  const b = await finance.createCycle(F.values.scenario8);
  const payment = await finance.recordPayment(F.values.scenario9);

  await assert.rejects(
    () => finance.allocatePayment(payment.id, b.charges[0]!.id, F.values.scenario10),
    /same Tenancy|cross Tenancy/i,
  );
  await finance.allocatePayment(payment.id, a.charges[0]!.id, F.values.scenario11);
  await assert.rejects(
    () => finance.allocatePayment(payment.id, a.charges[0]!.id, F.values.scenario12),
    /exceed|remaining/i,
  );
});

test('charge allocations and deposit applications share the payment amount cap', async () => {
  const { finance } = services();
  const cycle = await finance.createCycle(F.values.scenario13);
  const deposit = await finance.createDeposit(F.values.scenario14);
  const payment = await finance.recordPayment(F.values.scenario15);

  await finance.allocatePayment(payment.id, cycle.charges[0]!.id, F.values.scenario16);
  await finance.applyPaymentToDeposit(payment.id, deposit.id, F.values.scenario17);
  await assert.rejects(
    () => finance.applyPaymentToDeposit(payment.id, deposit.id, F.values.scenario18),
    /exceed|remaining/i,
  );
  assert.deepEqual(
    (await finance.listDepositEvents(deposit.id)).map((event) => event.eventType),
    F.values.scenario19,
  );
});

test('deposit projection blocks OPEN requirement-change semantics after partial funding', async () => {
  const { finance, transactions } = services();
  await transactions.run(async ({ repositories }) => {
    await repositories.tenancy.insertTerms(F.values.scenario20);
  });
  const deposit = await finance.createDeposit(F.values.scenario21);
  const payment = await finance.recordPayment(F.values.scenario22);
  await finance.applyPaymentToDeposit(payment.id, deposit.id, F.values.scenario23);

  const partial = await finance.findDepositProjectionForTenancy(F.values.scenario24);
  assert.equal(partial.requirementAmount, F.values.scenario25);
  assert.equal(partial.fundedAmount, F.values.scenario26);
  assert.equal(partial.state, F.values.scenario27);
  assert.equal(partial.blockedByOpenPolicy, F.values.scenario28);

  await transactions.run(async ({ repositories }) => {
    await repositories.tenancy.insertTerms(F.values.scenario29);
  });

  const blocked = await finance.findDepositProjectionForTenancy(F.values.scenario30);
  assert.equal(blocked.requirementAmount, F.values.scenario31);
  assert.equal(blocked.state, F.values.scenario32);
  assert.equal(blocked.blockedByOpenPolicy, F.values.scenario33);
  assert.equal(blocked.fundedAmount, F.values.scenario34);
  assert.equal(blocked.heldAmount, F.values.scenario35);
});

test('confirmed payment correction voids old fact and requires a replacement payment', async () => {
  const { finance } = services();
  const payment = await finance.recordPayment(F.values.scenario36);
  const replacement = await finance.correctPayment(payment.id, F.values.scenario37);

  assert.equal(replacement.verification, F.values.scenario38);
  assert.equal((await finance.findPaymentById(payment.id)).replacementPaymentId, replacement.id);
  assert.ok((await finance.findPaymentById(payment.id)).voidedOrReversedAt);
});

test('receipt is evidence for confirmed payment and keeps issued/voided history', async () => {
  const { finance, receipts } = services();
  const payment = await finance.recordPayment(F.values.scenario39);
  const issued = await receipts.issue(payment.id);
  assert.equal(issued.status, F.values.scenario40);
  assert.equal(issued.paymentId, payment.id);
  assert.equal('amount' in issued, F.values.scenario41);

  const voided = await receipts.void(issued.id);
  assert.equal(voided.status, F.values.scenario42);
  const replacement = await receipts.issue(payment.id);
  assert.equal((await receipts.findById(issued.id)).replacementReceiptId, replacement.id);
});

test('deposit settlement appends refunded and retained provenance events', async () => {
  const { finance } = services();
  const deposit = await finance.createDeposit(F.values.scenario43);
  const payment = await finance.recordPayment(F.values.scenario44);
  await finance.applyPaymentToDeposit(payment.id, deposit.id, F.values.scenario45);
  const settlement = await finance.settleDeposit(deposit.id, F.values.scenario46);
  assert.equal(settlement.depositId, deposit.id);
  assert.deepEqual(
    (await finance.listDepositEvents(deposit.id)).map((event) => event.eventType),
    F.values.scenario47,
  );
});

test('outstanding follows active allocations and ignores unallocated or voided payments', async () => {
  const { finance, transactions } = services();
  const cycle = await finance.createCycle(F.values.scenario48);
  const chargeId = cycle.charges[0]!.id;
  assert.equal(cycle.charges[0]?.outstandingAmount, F.values.scenario49);
  await finance.recordPayment(F.values.scenario50);
  assert.equal(
    (await finance.findById(cycle.id)).charges[0]?.outstandingAmount,
    F.values.scenario51,
  );
  const partial = await finance.recordPayment(F.values.scenario52);
  await finance.allocatePayment(partial.id, chargeId, F.values.scenario53);
  assert.equal(
    (await finance.findById(cycle.id)).charges[0]?.outstandingAmount,
    F.values.scenario54,
  );
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findPayment(partial.id),
  );
  assert.ok(stored);
  await transactions.run(({ repositories }) =>
    repositories.finance.updatePayment({ ...stored, voidedOrReversedAt: F.values.scenario55 }),
  );
  assert.equal(
    (await finance.findById(cycle.id)).charges[0]?.outstandingAmount,
    F.values.scenario56,
  );

  const over = await finance.createCycle(F.values.scenario57);
  const first = await finance.recordPayment(F.values.scenario58);
  const second = await finance.recordPayment(F.values.scenario59);
  await finance.allocatePayment(first.id, over.charges[0]!.id, F.values.scenario60);
  await finance.allocatePayment(second.id, over.charges[0]!.id, F.values.scenario61);
  assert.equal(
    (await finance.findById(over.id)).charges[0]?.outstandingAmount,
    F.values.scenario62,
  );
});

test('manual service rejects parsed provider provenance before recording or correcting', async () => {
  const { finance } = services();
  const manual = F.values.scenario63;
  for (const provenance of F.values.scenario64) {
    const input = plainToInstance(RecordPaymentDto, { ...manual, ...provenance });
    await assert.rejects(() => finance.recordPayment(input), BadRequestException);
    assert.deepEqual(await finance.findPaymentsByTenancyId(manual.tenancyId), F.values.scenario65);
  }
  const original = await finance.recordPayment(plainToInstance(RecordPaymentDto, manual));
  assert.equal(original.verification, F.values.scenario66);
  for (const provenance of F.values.scenario67) {
    const input = Object.assign(
      plainToInstance(RecordPaymentDto, { ...manual, ...provenance }),
      F.values.scenario68,
    );
    await assert.rejects(() => finance.correctPayment(original.id, input), BadRequestException);
    assert.deepEqual(await finance.findPaymentById(original.id), original);
    assert.equal(
      (await finance.findPaymentsByTenancyId(manual.tenancyId)).length,
      F.values.scenario69,
    );
  }
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Client } from 'pg';

import { ConflictException } from '@nestjs/common';

import {
  HttpMomoPaymentClient,
  type MomoPaymentClient,
} from '../../../src/modules/payment-gateway/momo/momo-client';
import { PaymentGatewayService } from '../../../src/modules/payment-gateway/services/payment-gateway.service';
import { MomoGatewayAdapter } from '../../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { GatewayProviderRegistry } from '../../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { GatewaySettlementService } from '../../../src/modules/payment-gateway/services/gateway-settlement.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import { PersistenceUniqueViolation } from '../../../src/persistence/errors';
import type { TransactionManager } from '../../../src/persistence/ports/transaction-manager';
import {
  TEST_MOMO,
  assertCheckoutRowLockWaiter,
  createBarrier,
  createLatch,
  gatewayFixture,
  openGatewayPool,
  signedCheckoutIpn,
} from './gateway-test-support';

function protocol() {
  return new HttpMomoPaymentClient(TEST_MOMO);
}

function testMomo(): MomoPaymentClient {
  const proto = protocol();
  return {
    snapshot: (id) => proto.snapshot(id),
    verifyIpn: proto.verifyIpn.bind(proto),
    async createCaptureWallet() {
      return {
        resultCode: 0,
        message: 'ok',
        payUrl: 'https://test-payment.momo.vn/pay',
        deeplink: null,
      };
    },
  };
}

function gatewayFor(manager: TransactionManager) {
  return new PaymentGatewayService(new TenancyService(manager),
    manager,
    new GatewayProviderRegistry(new MomoGatewayAdapter(testMomo())),
    new GatewaySettlementService(manager));
}

async function downstreamCounts(url: string, paymentId: string | null) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const [allocations, receipts, deposits] = await Promise.all([
      client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM payment_allocations WHERE payment_id = $1 OR $1 IS NULL',
        [paymentId],
      ),
      client.query<{ n: number }>('SELECT count(*)::int AS n FROM receipts'),
      client.query<{ n: number }>('SELECT count(*)::int AS n FROM deposit_payment_applications'),
    ]);
    return {
      allocations: allocations.rows[0]?.n ?? -1,
      receipts: receipts.rows[0]?.n ?? -1,
      deposits: deposits.rows[0]?.n ?? -1,
    };
  } finally {
    await client.end();
  }
}

test('callback waits on held checkout lock; concurrent success IPNs write one Payment', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  console.log('database=trooi_test');
  const f = await gatewayFixture(url);
  const poolB = openGatewayPool(url);
  const a = gatewayFor(f.manager);
  const b = gatewayFor(poolB.manager);
  const releaseLock = createBarrier();
  try {
    const created = await a.createCheckout(
      { tenancyId: f.ids.tenancy, amount: '1000' },
      f.ids.creator,
      randomUUID(),
    );
    const record = await f.finance.findGatewayCheckout(created.id);
    assert.ok(record);
    const held = createLatch();
    const holder = f.manager.run(async ({ repositories }) => {
      await repositories.finance.lockGatewayCheckout(created.id);
      held.signal();
      await releaseLock.gate;
    });
    await held.ready;
    const ipnOne = b.handleMomoIpn(signedCheckoutIpn(record, { transId: 11 }));
    const ipnTwo = a.handleMomoIpn(signedCheckoutIpn(record, { transId: 11 }));
    await assertCheckoutRowLockWaiter(url);
    releaseLock.release();
    await holder;
    await Promise.all([ipnOne, ipnTwo]);
    const first = await f.finance.findGatewayCheckout(created.id);
    assert.equal(first?.status, 'SUCCEEDED');
    const payments = await f.finance.findPaymentsForTenancy(f.ids.tenancy);
    assert.equal(payments.length, 1);
    assert.equal(first?.resultingPaymentId, payments[0]?.paymentId);
    const notes = await f.notifications.findNotificationsByRecipient(f.ids.creator);
    assert.equal(notes.length, 1);
    const counts = await downstreamCounts(url, payments[0]!.paymentId);
    assert.equal(counts.allocations, 0);
    assert.equal(counts.receipts, 0);
    assert.equal(counts.deposits, 0);
  } finally {
    releaseLock.release();
    await poolB.close();
    await f.db.destroy();
  }
});

test('payment insert rollback leaves zero money side effects; retry settles; duplicate transId is rejected', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url);
  let failAfterPayment = true;
  const manager: TransactionManager = {
    async run(work) {
      return f.manager.run(async (context) => {
        const insert = context.repositories.finance.insertPayment.bind(context.repositories.finance);
        context.repositories.finance.insertPayment = async (payment) => {
          await insert(payment);
          if (failAfterPayment) throw new Error('injected payment rollback');
        };
        return work(context);
      });
    },
  };
  const gateway = gatewayFor(manager);
  const other = gatewayFor(f.manager);
  try {
    const first = await gateway.createCheckout(
      { tenancyId: f.ids.tenancy, amount: '1000' },
      f.ids.creator,
      randomUUID(),
    );
    const record = await f.finance.findGatewayCheckout(first.id);
    assert.ok(record);
    await assert.rejects(
      gateway.handleMomoIpn(signedCheckoutIpn(record, { transId: 21 })),
      /injected payment rollback/,
    );
    assert.equal((await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 0);
    assert.equal((await f.finance.findGatewayCheckout(first.id))?.status, 'CREATED');
    assert.equal((await f.notifications.findNotificationsByRecipient(f.ids.creator)).length, 0);
    failAfterPayment = false;
    await gateway.handleMomoIpn(signedCheckoutIpn(record, { transId: 21 }));
    assert.equal((await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 1);
    const second = await other.createCheckout(
      { tenancyId: f.ids.tenancy, amount: '1000' },
      f.ids.creator,
      randomUUID(),
    );
    const otherRecord = await f.finance.findGatewayCheckout(second.id);
    assert.ok(otherRecord);
    await assert.rejects(
      other.handleMomoIpn(signedCheckoutIpn(otherRecord, { transId: 21 })),
      (error: unknown) =>
        error instanceof ConflictException || error instanceof PersistenceUniqueViolation,
    );
    assert.equal((await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 1);
    assert.equal((await f.finance.findGatewayCheckout(second.id))?.status, 'CREATED');
  } finally {
    await f.db.destroy();
  }
});

test('final-failure and success IPNs serialize; contradictory loser cannot create or undo money', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url);
  const poolB = openGatewayPool(url);
  const a = gatewayFor(f.manager);
  const b = gatewayFor(poolB.manager);
  try {
    const created = await a.createCheckout(
      { tenancyId: f.ids.tenancy, amount: '1000' },
      f.ids.creator,
      randomUUID(),
    );
    const record = await f.finance.findGatewayCheckout(created.id);
    assert.ok(record);
    const results = await Promise.allSettled([
      a.handleMomoIpn(signedCheckoutIpn(record, { transId: 31, resultCode: 1006 })),
      b.handleMomoIpn(signedCheckoutIpn(record, { transId: 32, resultCode: 0 })),
    ]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(results.filter((item) => item.status === 'rejected').length, 1);
    const stored = await f.finance.findGatewayCheckout(created.id);
    const payments = await f.finance.findPaymentsForTenancy(f.ids.tenancy);
    if (stored?.status === 'SUCCEEDED') {
      assert.equal(payments.length, 1);
      assert.equal(stored.providerTransId, '32');
    } else {
      assert.equal(stored?.status, 'FAILED');
      assert.equal(payments.length, 0);
      assert.equal(stored?.terminalEvidence?.includes('1006'), true);
    }
  } finally {
    await poolB.close();
    await f.db.destroy();
  }
});

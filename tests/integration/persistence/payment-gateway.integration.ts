import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  HttpMomoPaymentClient,
  type MomoPaymentClient,
} from '../../../src/modules/payment-gateway/momo/momo-client';
import { PaymentGatewayService } from '../../../src/modules/payment-gateway/services/payment-gateway.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import type { TransactionManager } from '../../../src/persistence/ports/transaction-manager';
import {
  TEST_MOMO,
  createBarrier,
  createLatch,
  gatewayFixture,
  openGatewayPool,
  signedCheckoutIpn,
} from './gateway-test-support';

function protocol() {
  return new HttpMomoPaymentClient(TEST_MOMO);
}

function gatewayFor(manager: TransactionManager, momo: MomoPaymentClient, clock?: () => Date) {
  return new PaymentGatewayService(new TenancyService(manager), manager, momo, undefined, clock);
}

test('two managers elect one same-key intent and replay the same provider IDs after restart', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  console.log('database=trooi_test');
  const f = await gatewayFixture(url);
  const poolB = openGatewayPool(url);
  const proto = protocol();
  const hold = createBarrier();
  const entered = createLatch();
  let calls = 0;
  const momo = {
    snapshot: (id: string) => proto.snapshot(id),
    verifyIpn: proto.verifyIpn.bind(proto),
    async createCaptureWallet() {
      calls += 1;
      entered.signal();
      await hold.gate;
      return {
        resultCode: 0,
        message: 'ok',
        payUrl: 'https://test-payment.momo.vn/pay',
        deeplink: null,
      };
    },
  };
  const a = gatewayFor(f.manager, momo);
  const b = gatewayFor(poolB.manager, momo);
  const key = randomUUID();
  const input = { tenancyId: f.ids.tenancy, amount: '1000' };
  try {
    const first = a.createCheckout(input, f.ids.creator, key);
    await entered.ready;
    const second = await b.createCheckout(input, f.ids.creator, key);
    hold.release();
    const original = await first;
    assert.equal(second.id, original.id);
    assert.equal(calls, 1);
    const stored = await f.finance.findGatewayCheckout(original.id);
    assert.ok(stored);
    await f.db.destroy();
    const replayed = await b.createCheckout(input, f.ids.creator, key);
    assert.equal(replayed.id, original.id);
    assert.equal(replayed.status, 'CREATED');
    const again = await poolB.finance.findGatewayCheckout(original.id);
    assert.equal(again?.providerRequestId, stored.providerRequestId);
    assert.equal(again?.providerOrderId, stored.providerOrderId);
    assert.equal(calls, 1);
    assert.equal((await poolB.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 0);
  } finally {
    hold.release();
    await poolB.close();
  }
});

test('late create CAS cannot overwrite a verified IPN settlement', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url);
  const proto = protocol();
  const hold = createBarrier();
  const entered = createLatch();
  const momo = {
    snapshot: (id: string) => proto.snapshot(id),
    verifyIpn: proto.verifyIpn.bind(proto),
    async createCaptureWallet() {
      entered.signal();
      await hold.gate;
      return {
        resultCode: 0,
        message: 'ok',
        payUrl: 'https://test-payment.momo.vn/pay',
        deeplink: null,
      };
    },
  };
  const gateway = gatewayFor(f.manager, momo);
  const key = randomUUID();
  try {
    const creating = gateway.createCheckout(
      { tenancyId: f.ids.tenancy, amount: '1000' },
      f.ids.creator,
      key,
    );
    await entered.ready;
    const intent = await f.finance.findGatewayCheckoutByClientKey(f.ids.creator, key);
    assert.ok(intent);
    await gateway.handleMomoIpn(signedCheckoutIpn(intent, { transId: 91 }));
    const settled = await f.finance.findGatewayCheckout(intent.checkoutId);
    assert.equal(settled?.status, 'SUCCEEDED');
    const paymentId = settled?.resultingPaymentId;
    hold.release();
    const created = await creating;
    assert.equal(created.status, 'SUCCEEDED');
    assert.equal(created.resultingPaymentId, paymentId);
    const after = await f.finance.findGatewayCheckout(intent.checkoutId);
    assert.equal(after?.status, 'SUCCEEDED');
    assert.equal(after?.resultingPaymentId, paymentId);
    assert.equal(after?.providerTransId, '91');
    assert.equal((await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 1);
  } finally {
    hold.release();
    await f.db.destroy();
  }
});

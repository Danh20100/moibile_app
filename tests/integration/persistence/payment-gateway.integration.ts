import assert from 'node:assert/strict';
import { paymentData } from '../../support/payment-fixtures';
import test from 'node:test';

import {
  HttpMomoPaymentClient,
  type MomoPaymentClient,
} from '../../../src/modules/payment-gateway/momo/momo-client';
import { PaymentGatewayService } from '../../../src/modules/payment-gateway/services/payment-gateway.service';
import { MomoGatewayAdapter } from '../../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { GatewayProviderRegistry } from '../../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { GatewaySettlementService } from '../../../src/modules/payment-gateway/services/gateway-settlement.service';
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
  return new PaymentGatewayService(
    new TenancyService(manager),
    manager,
    new GatewayProviderRegistry(new MomoGatewayAdapter(momo)),
    new GatewaySettlementService(manager, clock),
    undefined,
    clock,
  );
}

test('two managers elect one same-key intent and replay the same provider IDs after restart', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  console.log('database=' + paymentData.values.trooi_test);
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
      return { ...paymentData.flow.successfulReply };
    },
  };
  const a = gatewayFor(f.manager, momo);
  const b = gatewayFor(poolB.manager, momo);
  const key = f.nextId();
  const input = { tenancyId: f.ids.tenancy, amount: paymentData.flow.checkoutAmount };
  try {
    const first = a.createCheckout(input, f.ids.creator, key);
    await entered.ready;
    const second = await b.createCheckout(input, f.ids.creator, key);
    hold.release();
    const original = await first;
    assert.equal(second.id, original.id);
    assert.equal(calls, paymentData.numbers.expectedCount1);
    const stored = await f.finance.findGatewayCheckout(original.id);
    assert.ok(stored);
    await f.db.destroy();
    const replayed = await b.createCheckout(input, f.ids.creator, key);
    assert.equal(replayed.id, original.id);
    assert.equal(replayed.status, paymentData.values.CREATED);
    const again = await poolB.finance.findGatewayCheckout(original.id);
    assert.equal(again?.providerRequestId, stored.providerRequestId);
    assert.equal(again?.providerOrderId, stored.providerOrderId);
    assert.equal(calls, paymentData.numbers.expectedCount1);
    assert.equal(
      (await poolB.finance.findPaymentsForTenancy(f.ids.tenancy)).length,
      paymentData.numbers.expectedCount0,
    );
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
      return { ...paymentData.flow.successfulReply };
    },
  };
  const gateway = gatewayFor(f.manager, momo);
  const key = f.nextId();
  try {
    const creating = gateway.createCheckout(
      { tenancyId: f.ids.tenancy, amount: paymentData.flow.checkoutAmount },
      f.ids.creator,
      key,
    );
    await entered.ready;
    const intent = await f.finance.findGatewayCheckoutByClientKey(f.ids.creator, key);
    assert.ok(intent);
    await gateway.handleMomoIpn(
      signedCheckoutIpn(intent, { transId: paymentData.flow.lateTransactionId }),
    );
    const settled = await f.finance.findGatewayCheckout(intent.checkoutId);
    assert.equal(settled?.status, paymentData.values.SUCCEEDED);
    const paymentId = settled?.resultingPaymentId;
    hold.release();
    const created = await creating;
    assert.equal(created.status, paymentData.values.SUCCEEDED);
    assert.equal(created.resultingPaymentId, paymentId);
    const after = await f.finance.findGatewayCheckout(intent.checkoutId);
    assert.equal(after?.status, paymentData.values.SUCCEEDED);
    assert.equal(after?.resultingPaymentId, paymentId);
    assert.equal(after?.providerTransId, paymentData.flow.lateTransactionText);
    assert.equal(
      (await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length,
      paymentData.numbers.expectedCount1,
    );
  } finally {
    hold.release();
    await f.db.destroy();
  }
});

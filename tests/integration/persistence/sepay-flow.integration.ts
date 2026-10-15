import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { loadFixture } from '../../support/fixture-loader';
import { gatewayFixture, TEST_MOMO } from './gateway-test-support';
import { HttpMomoPaymentClient } from '../../../src/modules/payment-gateway/momo/momo-client';
import { MomoGatewayAdapter } from '../../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { SepayGatewayAdapter } from '../../../src/modules/payment-gateway/providers/sepay-gateway.adapter';
import { GatewayProviderRegistry } from '../../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { GatewaySettlementService } from '../../../src/modules/payment-gateway/services/gateway-settlement.service';
import { PaymentGatewayService } from '../../../src/modules/payment-gateway/services/payment-gateway.service';
import { SepayHandoffService } from '../../../src/modules/payment-gateway/services/sepay-handoff.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import type { SepayProductionConfig } from '../../../src/modules/payment-gateway/sepay/sepay-production-config';
import type { SepayReadResult } from '../../../src/modules/payment-gateway/sepay/sepay-order-client';

interface Fixture {
  version: number;
  config: SepayProductionConfig;
  clock: string;
  proof: Omit<Extract<SepayReadResult, { kind: 'paid' }>, 'invoice'>;
  checkout: { amount: string; provider: 'SEPAY' };
  notification: { notification_type: string; transaction: { payment_method: string } };
  mismatchAmount: string;
  expected: {
    acknowledgement: { success: boolean };
    paid: string;
    created: string;
    handedOff: string;
    onePayment: number;
    noPayments: number;
    oneNotification: number;
    noAllocations: number;
    noReceipts: number;
  };
  handoffTokenParameter: string;
}
const F = loadFixture<Fixture>('payment/sepay-persistence-flow');

async function harness(amount: string) {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const storage = await gatewayFixture(url);
  const clock = () => new Date(F.clock);
  const adapter = new SepayGatewayAdapter(
    F.config,
    {
      readInvoice: async (invoice) => ({ ...F.proof, invoice, amount }),
    },
    clock,
  );
  const gateway = new PaymentGatewayService(
    new TenancyService(storage.manager),
    storage.manager,
    new GatewayProviderRegistry(
      new MomoGatewayAdapter(new HttpMomoPaymentClient(TEST_MOMO)),
      undefined,
      adapter,
    ),
    new GatewaySettlementService(storage.manager, clock),
    undefined,
    clock,
  );
  return { ...storage, gateway, handoff: new SepayHandoffService(storage.manager, adapter, clock) };
}

test('SePay callbacks settle one payment and preserve it while a fresh invoice is issued', async () => {
  const f = await harness(F.proof.amount);
  try {
    const key = f.nextId();
    const input = { ...F.checkout, tenancyId: f.ids.tenancy };
    const checkout = await f.gateway.createCheckout(input, f.ids.creator, key);
    const stored = await f.finance.findGatewayCheckout(checkout.id);
    assert.ok(stored);
    const body = { ...F.notification, order: { order_invoice_number: stored.providerOrderId } };
    assert.deepEqual(
      await f.gateway.handleSepayIpn(F.config.ipnSecretKey, body),
      F.expected.acknowledgement,
    );
    const payments = await f.finance.findPaymentsForTenancy(f.ids.tenancy);
    assert.equal(payments.length, F.expected.onePayment);
    assert.equal(payments[0].amount, F.proof.amount);
    const settled = await f.finance.findGatewayCheckout(checkout.id);
    assert.equal(settled?.status, F.expected.paid);
    assert.equal(settled?.resultingPaymentId, payments[0].paymentId);
    assert.equal(settled?.providerRemoteOrderId, F.proof.remoteOrderId);
    assert.equal(settled?.providerTransId, F.proof.transactionId);
    assert.deepEqual(
      await f.gateway.handleSepayIpn(F.config.ipnSecretKey, body),
      F.expected.acknowledgement,
    );
    assert.deepEqual(await f.finance.findPaymentsForTenancy(f.ids.tenancy), payments);
    const replay = await f.gateway.createCheckout(input, f.ids.creator, key);
    assert.equal(replay.id, checkout.id);
    const next = await f.gateway.createCheckout(input, f.ids.creator, f.nextId());
    assert.notEqual(next.id, checkout.id);
    const newRecord = await f.finance.findGatewayCheckout(next.id);
    assert.notEqual(newRecord?.providerOrderId, stored.providerOrderId);
    assert.equal(newRecord?.status, F.expected.created);
    assert.deepEqual(await f.finance.findPaymentsForTenancy(f.ids.tenancy), payments);
    assert.equal(
      (await f.notifications.findNotificationsByRecipient(f.ids.creator)).length,
      F.expected.oneNotification,
    );
    assert.equal(
      (await f.finance.findPaymentAllocations(payments[0].paymentId)).length,
      F.expected.noAllocations,
    );
    assert.equal(
      (await f.finance.findReceiptsForPayment(payments[0].paymentId)).length,
      F.expected.noReceipts,
    );
  } finally {
    await f.db.destroy();
  }
});

test('SePay amount mismatch refuses acknowledgement and handoff issuance alone writes no money', async () => {
  const f = await harness(F.mismatchAmount);
  try {
    const checkout = await f.gateway.createCheckout(
      { ...F.checkout, tenancyId: f.ids.tenancy },
      f.ids.creator,
      f.nextId(),
    );
    assert.ok(checkout.payUrl);
    const token = new URL(checkout.payUrl).searchParams.get(F.handoffTokenParameter);
    assert.ok(token);
    await f.handoff.read(token);
    await f.handoff.release(token);
    assert.equal(
      (await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length,
      F.expected.noPayments,
    );
    const stored = await f.finance.findGatewayCheckout(checkout.id);
    assert.ok(stored);
    assert.equal(stored.status, F.expected.handedOff);
    await assert.rejects(
      f.gateway.handleSepayIpn(F.config.ipnSecretKey, {
        ...F.notification,
        order: { order_invoice_number: stored.providerOrderId },
      }),
      ServiceUnavailableException,
    );
    assert.equal(
      (await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length,
      F.expected.noPayments,
    );
    assert.deepEqual(await f.finance.findGatewayCheckout(checkout.id), stored);
  } finally {
    await f.db.destroy();
  }
});

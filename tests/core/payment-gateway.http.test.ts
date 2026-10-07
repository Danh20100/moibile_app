import { HttpMomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
import { momoIpnRaw, signMomoRaw } from '../../src/modules/payment-gateway/momo/momo-hmac';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { ResourceAuthorizationService } from '../../src/common/auth/resource-authorization.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';
import assert from 'node:assert/strict';
import test from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { startGatewayHttpHarness } from './support/payment-gateway-http-harness';

const payload = {
  partnerCode: 'TEST',
  orderId: 'order-1',
  requestId: 'request-1',
  amount: 1000,
  orderInfo: 'Rent',
  orderType: 'momo_wallet',
  transId: 123,
  resultCode: 0,
  message: 'Successful.',
  payType: 'qr',
  responseTime: 1720000000000,
  extraData: '',
  signature: 'signed-transport',
};
const tenancy = {
  tenancyId: 'tenancy-1',
  roomId: 'room-1',
  status: 'ACTIVE' as const,
  startedAt: '2026-10-05T00:00:00.000Z',
  endedAt: null,
  endReason: null,
};
async function harness(onCreate?: (key: string, actor: string) => void) {
  return startGatewayHttpHarness({
    service: {
      async handleMomoIpn(input) {
        if (input.signature !== payload.signature)
          throw new UnauthorizedException('Invalid MoMo IPN signature');
      },
      async createCheckout(input, actor, key) {
        onCreate?.(key, actor);
        return {
          id: 'created-1',
          tenancyId: input.tenancyId,
          amount: input.amount,
          provider: 'MOMO',
          status: 'INITIATED',
          referenceCode: 'Rent',
          createdAt: '2026-10-05T00:00:00.000Z',
          replayAllowed: true,
        };
      },
      async findCheckout(id) {
        return {
          replayAllowed: false,
          id,
          tenancyId: 'tenancy-1',
          amount: '1000.00',
          referenceCode: 'Rent',
          provider: 'MOMO',
          status: 'CREATED',
          createdAt: '2026-10-05T00:00:00.000Z',
        };
      },
    },
    authz: {
      async assertCanAccessTenancy() {
        return tenancy;
      },
      async assertCanReadTenancy() {
        return tenancy;
      },
    },
    verifier: {
      async verify(token) {
        if (token !== 'test-credential') throw new UnauthorizedException('Invalid test credential');
        return { issuer: 'https://accounts.google.com', subject: 'http-test-user' };
      },
    },
  });
}
function post(baseUrl: string, body: unknown) {
  return fetch(`${baseUrl}/finance/checkouts/momo/ipn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
test('ipn_ack_is_empty_204', async (t) => {
  const app = await harness();
  t.after(app.close);
  const response = await post(app.baseUrl, payload);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
});
test('unknown_ipn_fields_are_rejected', async (t) => {
  const app = await harness();
  t.after(app.close);
  const response = await post(app.baseUrl, { ...payload, clientControlled: true });
  assert.equal(response.status, 400);
});
test('ipn_errors_remain_non_204', async (t) => {
  const app = await harness();
  t.after(app.close);
  const response = await post(app.baseUrl, { ...payload, signature: 'invalid' });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.statusCode, 401);
  assert.equal(body.message, 'Invalid MoMo IPN signature');
});
test('required_ipn_transport_fields_are_validated', async (t) => {
  const app = await harness();
  t.after(app.close);
  for (const field of Object.keys(payload)) {
    const body: Record<string, unknown> = { ...payload };
    delete body[field];
    const response = await post(app.baseUrl, body);
    assert.equal(response.status, 400, `missing ${field}`);
    await response.text();
  }
  for (const body of [
    { ...payload, amount: '1000' },
    { ...payload, resultCode: 0.5 },
    { ...payload, signature: '' },
  ]) {
    const response = await post(app.baseUrl, body);
    assert.equal(response.status, 400);
    await response.text();
  }
});
test('ordinary_get_keeps_envelope_and_real_auth_guard', async (t) => {
  const app = await harness();
  t.after(app.close);
  const url = `${app.baseUrl}/finance/checkouts/checkout-1`;
  const unauthenticated = await fetch(url);
  assert.equal(unauthenticated.status, 401);
  await unauthenticated.text();
  const invalid = await fetch(url, { headers: { authorization: 'Bearer invalid' } });
  assert.equal(invalid.status, 401);
  await invalid.text();
  const response = await fetch(url, { headers: { authorization: 'Bearer test-credential' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.id, 'checkout-1');
  assert.equal(body.data.status, 'CREATED');
  assert.equal(typeof body.timestamp, 'string');
});

test('checkout POST requires a UUID key and forwards it with verified actor', async (t) => {
  const calls: { key: string; actor: string }[] = [];
  const app = await harness((key, actor) => calls.push({ key, actor }));
  t.after(app.close);
  for (const key of [
    undefined,
    '',
    'not-a-uuid',
    '10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000002',
  ]) {
    const response = await fetch(`${app.baseUrl}/finance/checkouts`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-credential',
        'content-type': 'application/json',
        ...(key === undefined ? {} : { 'Idempotency-Key': key }),
      },
      body: JSON.stringify({ tenancyId: 'tenancy-1', amount: '1000.00' }),
    });
    assert.equal(response.status, 400);
    await response.text();
  }
  assert.equal(calls.length, 0);
  const key = '10000000-0000-4000-8000-000000000099';
  const response = await fetch(`${app.baseUrl}/finance/checkouts`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-credential',
      'content-type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify({ tenancyId: 'tenancy-1', amount: '1000.00' }),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.data.replayAllowed, true);
  assert.equal(calls[0]?.key, key);
  assert.ok(calls[0]?.actor);
});

test('production Nest service resolves optional clock and auth defaults with MoMo disabled', async (t) => {
  // The HTTP harness builds production decorator metadata before loading the actual service.
  const transport = await harness();
  await transport.close();
  const { createRequire } = await import('node:module');
  const require = createRequire(__filename);
  const { Module } = require('@nestjs/common') as typeof import('@nestjs/common');
  const { NestFactory } = require('@nestjs/core') as typeof import('@nestjs/core');
  const { PaymentGatewayService } =
    require('../../build/modules/payment-gateway/services/payment-gateway.service') as typeof import('../../src/modules/payment-gateway/services/payment-gateway.service');
  const { TenancyService } =
    require('../../build/modules/tenancy/services/tenancy.service') as typeof import('../../src/modules/tenancy/services/tenancy.service');
  const { TRANSACTION_MANAGER } =
    require('../../build/persistence/ports/transaction-manager') as typeof import('../../src/persistence/ports/transaction-manager');
  const { MOMO_PAYMENT_CLIENT, HttpMomoPaymentClient, loadMomoConfig } =
    require('../../build/modules/payment-gateway/momo/momo-client') as typeof import('../../src/modules/payment-gateway/momo/momo-client');
  const disabled = new HttpMomoPaymentClient(loadMomoConfig({}));
  class RuntimeModule {}
  Module({
    providers: [
      PaymentGatewayService,
      TenancyService,
      { provide: TRANSACTION_MANAGER, useValue: createCoreTestTransactionManager() },
      { provide: MOMO_PAYMENT_CLIENT, useValue: disabled },
    ],
  })(RuntimeModule);
  const app = await NestFactory.createApplicationContext(RuntimeModule, {
    logger: false,
    abortOnError: false,
  });
  t.after(() => app.close());
  const service = app.get(PaymentGatewayService);
  assert.ok(service instanceof PaymentGatewayService);
  await assert.rejects(service.findCheckout('absent', 'actor'), /not found/);
  assert.throws(() => disabled.snapshot('checkout'), /optional channel is unavailable/);
});

test('IPN numeric transport values are safe and nonnegative', async (t) => {
  const app = await harness();
  t.after(app.close);
  for (const field of ['amount', 'transId', 'resultCode', 'responseTime']) {
    for (const value of [-1, Number.MAX_SAFE_INTEGER + 1]) {
      const response = await post(app.baseUrl, { ...payload, [field]: value });
      assert.equal(response.status, 400, `${field}=${value}`);
      await response.text();
    }
  }
});

async function settlementHarness(status: 'INITIATED' | 'UNKNOWN' = 'INITIATED') {
  const transactions = createCoreTestTransactionManager();
  const config = {
    partnerCode: 'TEST',
    accessKey: 'access',
    secretKey: 'test-http-secret',
    endpoint: 'https://test-payment.momo.vn',
    ipnUrl: 'https://example.test/ipn',
    redirectUrl: 'trooi://payment/momo',
  };
  const client = new HttpMomoPaymentClient(config);
  const snapshot = client.snapshot('checkout-http');
  await transactions.run(async ({ repositories }) => {
    await repositories.tenancy.createTenancy(tenancy);
    await repositories.tenancy.insertParticipant({
      tenancyParticipantId: 'participant-http',
      tenancyId: tenancy.tenancyId,
      role: 'PRIMARY',
      userId: 'creator-http',
      joinedAt: tenancy.startedAt,
      leftAt: null,
    });
    await repositories.finance.insertGatewayCheckout({
      checkoutId: 'checkout-http',
      tenancyId: tenancy.tenancyId,
      createdByUserId: 'creator-http',
      amount: '1000.00',
      referenceCode: 'Rent',
      provider: 'MOMO',
      providerOrderId: payload.orderId,
      providerRequestId: payload.requestId,
      status,
      idempotencyKey: '10000000-0000-4000-8000-000000000099',
      fingerprint: 'test',
      requestSnapshot: snapshot,
      providerPartnerCode: 'TEST',
      payUrl: null,
      deeplink: null,
      resultingPaymentId: null,
      lastIpnPayload: null,
      lastIpnAt: null,
      createdAt: tenancy.startedAt,
      updatedAt: tenancy.startedAt,
      firstDispatchAt: null,
      dispatchLeaseOwner: null,
      dispatchLeaseUntil: null,
      replayBlocker: null,
      providerOutcome: null,
      providerResultCode: null,
      providerOutcomeStage: null,
      terminalEvidence: null,
      providerTransId: null,
      providerRemoteOrderId: null,
      handoffClaimedAt: null,
      handoffAttempt: 0,
    });
  });
  const service = new PaymentGatewayService(new TenancyService(transactions), transactions, client);
  const app = await startGatewayHttpHarness({
    service,
    authz: new ResourceAuthorizationService(transactions),
    verifier: {
      async verify() {
        throw new UnauthorizedException();
      },
    },
  });
  const signed = (changes: Partial<typeof payload> = {}) => {
    const event = { ...payload, extraData: snapshot.extraData, ...changes };
    event.signature = signMomoRaw(
      momoIpnRaw({
        accessKey: config.accessKey,
        partnerCode: event.partnerCode,
        orderId: event.orderId,
        requestId: event.requestId,
        amount: String(event.amount),
        orderInfo: event.orderInfo,
        orderType: event.orderType,
        transId: String(event.transId),
        resultCode: String(event.resultCode),
        message: event.message,
        payType: event.payType,
        responseTime: String(event.responseTime),
        extraData: event.extraData,
      }),
      config.secretKey,
    );
    return event;
  };
  const read = () =>
    transactions.run(async ({ repositories }) => ({
      checkout: await repositories.finance.findGatewayCheckout('checkout-http'),
      payments: await repositories.finance.findPaymentsForTenancy(tenancy.tenancyId),
      notifications: await repositories.notification.findNotificationsByRecipient('creator-http'),
    }));
  return { ...app, signed, read };
}

test('final_failure_rejects_success_reversal', async (t) => {
  const app = await settlementHarness();
  t.after(app.close);
  const failure = await post(app.baseUrl, app.signed({ resultCode: 1006 }));
  assert.equal(failure.status, 204);
  assert.equal(await failure.text(), '');
  const terminal = await app.read();
  const lateSuccess = await post(app.baseUrl, app.signed());
  assert.equal(lateSuccess.status, 409);
  await lateSuccess.text();
  const { checkout: storedCheckout, payments: insertedPayments } = await app.read();
  assert.equal(storedCheckout!.status, 'FAILED');
  assert.equal(insertedPayments.length, 0);
  for (const resultCode of [1006, 1000]) {
    const duplicate = await post(app.baseUrl, app.signed({ resultCode }));
    assert.equal(duplicate.status, 204);
    assert.equal(await duplicate.text(), '');
  }
  assert.deepEqual(await app.read(), terminal);
});

test('actual HTTP verified one-step success is atomic and terminal', async (t) => {
  const app = await settlementHarness('UNKNOWN');
  t.after(app.close);
  for (const changes of [{ requestId: 'wrong' }, { amount: 2000 }, { extraData: 'wrong' }]) {
    const before = await app.read();
    const response = await post(app.baseUrl, app.signed(changes));
    assert.equal(response.status, 409);
    await response.text();
    assert.deepEqual(await app.read(), before);
  }
  const invalid = await post(app.baseUrl, { ...app.signed(), signature: 'invalid' });
  assert.equal(invalid.status, 401);
  await invalid.text();
  const pending = await post(app.baseUrl, app.signed({ resultCode: 7000, transId: 0 }));
  assert.equal(pending.status, 204);
  await pending.text();
  assert.equal((await app.read()).payments.length, 0);
  for (const resultCode of [9000, 0]) {
    const success = await post(app.baseUrl, app.signed({ resultCode }));
    assert.equal(success.status, 204);
    assert.equal(await success.text(), '');
  }
  const terminal = await app.read();
  assert.equal(terminal.checkout!.status, 'SUCCEEDED');
  assert.equal(terminal.payments.length, 1);
  assert.equal(terminal.notifications.length, 1);
  assert.equal(terminal.checkout!.resultingPaymentId, terminal.payments[0]!.paymentId);
  for (const changes of [{ resultCode: 1006 }, { transId: 456 }]) {
    const conflict = await post(app.baseUrl, app.signed(changes));
    assert.equal(conflict.status, 409);
    await conflict.text();
  }
  const latePending = await post(app.baseUrl, app.signed({ resultCode: 1000, transId: 0 }));
  assert.equal(latePending.status, 204);
  await latePending.text();
  assert.deepEqual(await app.read(), terminal);
});

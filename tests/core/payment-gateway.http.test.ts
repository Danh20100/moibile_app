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

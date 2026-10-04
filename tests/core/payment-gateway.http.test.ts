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
async function harness() {
  return startGatewayHttpHarness({
    service: {
      async handleMomoIpn(input) {
        if (input.signature !== payload.signature)
          throw new UnauthorizedException('Invalid MoMo IPN signature');
      },
      async createCheckout() {
        throw new Error('Unused');
      },
      async findCheckout(id) {
        return {
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

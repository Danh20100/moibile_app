import assert from 'node:assert/strict';
import test from 'node:test';
import fixtures from './fixtures/momo-signed-payloads.json';
import {
  HttpMomoPaymentClient,
  loadMomoConfig,
  requireMomoConfig,
} from '../../src/modules/payment-gateway/momo/momo-client';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const config = {
  partnerCode: 'TEST',
  accessKey: 'access',
  secretKey: fixtures.secret,
  endpoint: 'https://test-payment.momo.vn',
  ipnUrl: 'https://example.test/ipn',
  redirectUrl: 'trooi://payment/momo',
};
const input = {
  orderId: 'order-1',
  requestId: 'req-1',
  amountVnd: 4470000,
  orderInfo: 'TROOI P203 ABC',
  checkoutId: 'checkout-1',
};
const client = new HttpMomoPaymentClient(config);

test('existing checkout caller passes its checkout identity and rejects out-of-range decimal before Number/provider', async () => {
  const transactions = createCoreTestTransactionManager();
  await transactions.run(({ repositories }) =>
    repositories.tenancy.createTenancy({
      tenancyId: 'tenancy-1',
      roomId: 'room-1',
      status: 'ACTIVE',
      startedAt: null,
      endedAt: null,
      endReason: null,
    }),
  );
  let calls = 0;
  let checkoutIdentity = '';
  const gateway = new PaymentGatewayService(new TenancyService(transactions), transactions, {
    async createCaptureWallet(request) {
      calls++;
      checkoutIdentity = request.checkoutId;
      assert.equal(request.amountVnd, 4470000);
      return {
        resultCode: 0,
        message: 'ok',
        payUrl: 'https://test-payment.momo.vn/pay',
        deeplink: null,
      };
    },
    verifyIpn() {
      return false;
    },
  });
  const checkout = await gateway.createCheckout(
    { tenancyId: 'tenancy-1', amount: '4470000.00' },
    'user-1',
  );
  assert.equal(checkoutIdentity, checkout.id);
  for (const amount of ['999.00', '50000001.00', '9007199254740993.00', '1000.01']) {
    await assert.rejects(gateway.createCheckout({ tenancyId: 'tenancy-1', amount }, 'user-1'));
  }
  assert.equal(calls, 1);
});

async function withResponse(payload: unknown, run: () => Promise<void>, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(payload), { status });
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('verified create accepts the independent response and suppresses unsigned deeplink', async () => {
  await withResponse(fixtures.response.fields, async () => {
    const result = await client.createCaptureWallet(input);
    assert.equal(result.payUrl, fixtures.response.fields.payUrl);
    assert.equal(result.deeplink, null);
  });
});

test('create fails closed on unsigned, malformed, tampered or foreign identity responses', async () => {
  for (const patch of [
    { signature: undefined },
    { signature: 'invalid' },
    { partnerCode: 'OTHER' },
    { orderId: 'other' },
    { requestId: 'other' },
    { amount: 4470001 },
    { responseTime: undefined },
    { resultCode: '0' },
    { payUrl: undefined },
    { message: undefined },
  ]) {
    await withResponse({ ...fixtures.response.fields, ...patch }, async () => {
      await assert.rejects(client.createCaptureWallet(input));
    });
  }
  for (const payload of [
    null,
    [],
    'bad',
    {},
    { ...fixtures.response.fields, amount: '4470000.1' },
  ]) {
    await withResponse(payload, async () => {
      await assert.rejects(client.createCaptureWallet(input));
    });
  }
  await withResponse(
    fixtures.response.fields,
    async () => {
      await assert.rejects(client.createCaptureWallet(input));
    },
    500,
  );
});

test('IPN requires every signed field and exact expected identities and amount', () => {
  const expected = {
    partnerCode: 'TEST',
    orderId: 'order-1',
    requestId: 'req-1',
    amountVnd: 4470000,
    extraData: fixtures.ipn.fields.extraData,
  };
  assert.equal(client.verifyIpn(fixtures.ipn.fields, expected), true);
  for (const key of Object.keys(fixtures.ipn.fields)) {
    const payload: Record<string, unknown> = { ...fixtures.ipn.fields };
    delete payload[key];
    assert.equal(client.verifyIpn(payload, expected), false, key);
  }
  for (const patch of [
    { partnerCode: 'OTHER' },
    { orderId: 'other' },
    { requestId: 'other' },
    { amountVnd: 4470001 },
    { extraData: 'other' },
  ]) {
    assert.equal(client.verifyIpn(fixtures.ipn.fields, { ...expected, ...patch }), false);
  }
  for (const payload of [
    null,
    [],
    { ...fixtures.ipn.fields, signature: 'invalid' },
    { ...fixtures.ipn.fields, partnerCode: undefined },
    { ...fixtures.ipn.fields, amount: true },
  ])
    assert.equal(client.verifyIpn(payload), false);
});

test('signed malicious payment URLs and wrong-environment host never escape verification', async () => {
  for (const name of ['url0', 'url1', 'url2', 'url3', 'url4', 'url5', 'url6'] as const) {
    await withResponse(fixtures.responseVariants[name].fields, async () => {
      await assert.rejects(client.createCaptureWallet(input));
    });
  }
  const production = new HttpMomoPaymentClient({ ...config, endpoint: 'https://payment.momo.vn' });
  await withResponse(fixtures.responseVariants.url5.fields, async () => {
    assert.equal(
      (await production.createCaptureWallet(input)).payUrl,
      'https://payment.momo.vn/pay',
    );
  });
  await withResponse(fixtures.responseVariants.url7.fields, async () => {
    await assert.rejects(production.createCaptureWallet(input));
  });
});

test('verified non-accepted create outcomes preserve code without fabricating launch data', async () => {
  for (const fixture of [
    fixtures.responseVariants.code98,
    fixtures.responseVariants.code1000,
    fixtures.responseVariants.code9000,
    fixtures.responseVariants.code2019,
  ]) {
    await withResponse(fixture.fields, async () => {
      const result = await client.createCaptureWallet(input);
      assert.equal(result.resultCode, fixture.fields.resultCode);
      assert.equal(result.payUrl, null);
      assert.equal(result.deeplink, null);
    });
  }
});

test('request uses exact integer VND, base64 checkout identity, explicit autoCapture and 35s timeout', async () => {
  const original = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  let observedTimeout = 0;
  AbortSignal.timeout = (milliseconds) => {
    observedTimeout = milliseconds;
    return originalTimeout(milliseconds);
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://test-payment.momo.vn/v2/gateway/api/create');
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.method, 'POST');
    assert.ok(options?.signal);
    const body: unknown = JSON.parse(String(options?.body));
    assert.ok(
      typeof body === 'object' &&
        body !== null &&
        'amount' in body &&
        'extraData' in body &&
        'autoCapture' in body &&
        'signature' in body,
    );
    assert.equal(body.amount, 4470000);
    assert.equal(body.extraData, fixtures.request.fields.extraData);
    assert.equal(body.autoCapture, true);
    assert.equal(body.signature, fixtures.request.signature);
    return new Response(JSON.stringify(fixtures.response.fields));
  };
  try {
    await client.createCaptureWallet({ ...input, amountVnd: '4470000.00' });
    assert.equal(observedTimeout, 35000);
  } finally {
    globalThis.fetch = original;
    AbortSignal.timeout = originalTimeout;
  }
});

test('invalid/fractional/overflow VND is rejected before HTTP while inclusive limits dispatch', async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('transport sentinel');
  };
  try {
    for (const amountVnd of [
      999,
      50000001,
      1000.01,
      NaN,
      Infinity,
      '1000.01',
      '9007199254740993',
      '1e3',
      '-1000',
      '1000.000',
      '',
    ]) {
      await assert.rejects(client.createCaptureWallet({ ...input, amountVnd }), /Invalid MoMo/);
    }
    assert.equal(calls, 0);
    for (const amountVnd of [1000, 50000000, '1000.00', '50000000.00'])
      await assert.rejects(
        client.createCaptureWallet({ ...input, amountVnd }),
        /transport sentinel/,
      );
    assert.equal(calls, 4);
  } finally {
    globalThis.fetch = original;
  }
});

test('optional MoMo configuration does not fail construction/startup and rejects use when unavailable', async () => {
  const disabled = new HttpMomoPaymentClient(loadMomoConfig({}));
  await assert.rejects(disabled.createCaptureWallet(input), /optional channel is unavailable/);
  for (const patch of [
    { partnerCode: '' },
    { accessKey: '' },
    { secretKey: '' },
    { ipnUrl: '' },
    { ipnUrl: 'http://example.test/ipn' },
    { endpoint: 'https://evil.test' },
    { endpoint: 'http://test-payment.momo.vn' },
    { endpoint: 'https://user@test-payment.momo.vn' },
    { endpoint: 'https://test-payment.momo.vn/other' },
    { redirectUrl: '' },
  ])
    assert.throws(() => requireMomoConfig({ ...config, ...patch }));
});

test('transport, invalid JSON and body-read abort errors propagate without accepting a result', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new DOMException('timeout', 'TimeoutError');
    };
    await assert.rejects(client.createCaptureWallet(input), { name: 'TimeoutError' });
    globalThis.fetch = async () => new Response('not json');
    await assert.rejects(client.createCaptureWallet(input), SyntaxError);
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new DOMException('aborted', 'AbortError'));
          },
        }),
      );
    await assert.rejects(client.createCaptureWallet(input), { name: 'AbortError' });
  } finally {
    globalThis.fetch = original;
  }
});

test('payment-success IPN requires a positive provider transaction identity even when signed', () => {
  assert.equal(client.verifyIpn(fixtures.ipnZeroTransaction), false);
});

import { data as D } from '../support/momo-client-fixtures';
import assert from 'node:assert/strict';
import { createPaymentFixtureIds } from '../support/payment-fixtures';
import test from 'node:test';
import type fixturesType from '../fixtures/payment/momo-signed-payloads.json';
import { loadFixture } from '../support/fixture-loader';
const fixtures = loadFixture<typeof fixturesType>('payment/momo-signed-payloads');
import {
  HttpMomoPaymentClient,
  MomoVerificationError,
  loadMomoConfig,
  requireMomoConfig,
} from '../../src/modules/payment-gateway/momo/momo-client';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { MomoGatewayAdapter } from '../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { GatewayProviderRegistry } from '../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { GatewaySettlementService } from '../../src/modules/payment-gateway/services/gateway-settlement.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const config = {
  partnerCode: D.values.partnerCode,
  accessKey: D.values.accessKey,
  secretKey: fixtures.secret,
  endpoint: D.values.endpoint,
  ipnUrl: D.values.ipnUrl,
  redirectUrl: D.values.redirectUrl,
};
const input = {
  orderId: D.values.orderId,
  requestId: D.values.requestId,
  amountVnd: D.values.amountVnd,
  orderInfo: D.values.orderInfo,
  checkoutId: D.values.checkoutId,
};
const client = new HttpMomoPaymentClient(config);

test('existing checkout caller passes its checkout identity and rejects out-of-range decimal before Number/provider', async () => {
  const nextId = createPaymentFixtureIds();
  const transactions = createCoreTestTransactionManager();
  await transactions.run(({ repositories }) =>
    repositories.tenancy.createTenancy({
      tenancyId: D.values.tenancyId,
      roomId: D.values.roomId,
      status: D.values.status,
      startedAt: D.values.startedAt,
      endedAt: D.values.endedAt,
      endReason: D.values.endReason,
    }),
  );
  await transactions.run(({ repositories }) =>
    repositories.tenancy.insertParticipant({
      tenancyParticipantId: D.values.tenancyParticipantId,
      tenancyId: D.values.tenancyId2,
      userId: D.values.userId,
      role: D.values.role,
      joinedAt: D.values.joinedAt,
      leftAt: D.values.leftAt,
    }),
  );
  let calls = 0;
  let checkoutIdentity = D.values.checkoutIdentity;
  const gateway = new PaymentGatewayService(
    new TenancyService(transactions),
    transactions,
    new GatewayProviderRegistry(
      new MomoGatewayAdapter({
        snapshot: (id) => client.snapshot(id),
        async createCaptureWallet(request) {
          calls++;
          checkoutIdentity = request.checkoutId;
          assert.equal(request.amountVnd, D.values.equalScenario);
          return {
            resultCode: D.values.resultCode,
            message: D.values.message,
            payUrl: D.values.payUrl,
            deeplink: D.values.deeplink,
          };
        },
        verifyIpn() {
          return false;
        },
      }),
    ),
    new GatewaySettlementService(transactions),
  );
  const checkout = await gateway.createCheckout(
    { tenancyId: D.values.tenancyId3, amount: D.values.amount },
    D.values.createCheckoutScenario,
    nextId(),
  );
  assert.equal(checkoutIdentity, checkout.id);
  for (const amount of [
    D.values.scenarioValue,
    D.values.scenarioValue2,
    D.values.scenarioValue3,
    D.values.scenarioValue4,
  ]) {
    await assert.rejects(
      gateway.createCheckout(
        { tenancyId: D.values.tenancyId4, amount },
        D.values.createCheckoutScenario2,
        nextId(),
      ),
    );
  }
  assert.equal(calls, D.values.equalScenario2);
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
    assert.equal(result.deeplink, D.values.equalScenario3);
  });
});

test('create fails closed on unsigned, malformed, tampered or foreign identity responses', async () => {
  for (const patch of [
    { signature: undefined },
    { signature: D.values.signature },
    { partnerCode: D.values.partnerCode2 },
    { orderId: D.values.orderId2 },
    { requestId: D.values.requestId2 },
    { amount: D.values.amount2 },
    { responseTime: undefined },
    { resultCode: D.values.resultCode2 },
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
    D.values.scenarioValue5,
    {},
    { ...fixtures.response.fields, amount: D.values.amount3 },
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
    partnerCode: D.values.partnerCode3,
    orderId: D.values.orderId3,
    requestId: D.values.requestId3,
    amountVnd: D.values.amountVnd2,
    extraData: fixtures.ipn.fields.extraData,
  };
  assert.equal(client.verifyIpn(fixtures.ipn.fields, expected), D.values.equalScenario4);
  for (const key of Object.keys(fixtures.ipn.fields)) {
    const payload: Record<string, unknown> = { ...fixtures.ipn.fields };
    delete payload[key];
    assert.equal(client.verifyIpn(payload, expected), D.values.equalScenario5, key);
  }
  for (const patch of [
    { partnerCode: D.values.partnerCode4 },
    { orderId: D.values.orderId4 },
    { requestId: D.values.requestId4 },
    { amountVnd: D.values.amountVnd3 },
    { extraData: D.values.extraData },
  ]) {
    assert.equal(
      client.verifyIpn(fixtures.ipn.fields, { ...expected, ...patch }),
      D.values.equalScenario6,
    );
  }
  for (const payload of [
    null,
    [],
    { ...fixtures.ipn.fields, signature: D.values.signature2 },
    { ...fixtures.ipn.fields, partnerCode: undefined },
    { ...fixtures.ipn.fields, amount: D.values.amount4 },
  ])
    assert.equal(client.verifyIpn(payload), D.values.equalScenario7);
});

test('signed malicious payment URLs and wrong-environment host never escape verification', async () => {
  for (const name of [
    D.values.scenarioValue6,
    D.values.scenarioValue7,
    D.values.scenarioValue8,
    D.values.scenarioValue9,
    D.values.scenarioValue10,
    D.values.scenarioValue11,
    D.values.scenarioValue12,
  ] as const) {
    await withResponse(fixtures.responseVariants[name].fields, async () => {
      await assert.rejects(client.createCaptureWallet(input));
    });
  }
  const production = new HttpMomoPaymentClient({ ...config, endpoint: D.values.endpoint2 });
  await withResponse(fixtures.responseVariants.url5.fields, async () => {
    assert.equal((await production.createCaptureWallet(input)).payUrl, D.values.equalScenario8);
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
      assert.equal(result.payUrl, D.values.equalScenario9);
      assert.equal(result.deeplink, D.values.equalScenario10);
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
    assert.equal(url, D.values.equalScenario11);
    assert.equal(options?.redirect, D.values.equalScenario12);
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
    assert.equal(body.amount, D.values.equalScenario13);
    assert.equal(body.extraData, fixtures.request.fields.extraData);
    assert.equal(body.autoCapture, D.values.equalScenario14);
    assert.equal(body.signature, fixtures.request.signature);
    return new Response(JSON.stringify(fixtures.response.fields));
  };
  try {
    await client.createCaptureWallet({ ...input, amountVnd: D.values.amountVnd4 });
    assert.equal(observedTimeout, D.values.equalScenario15);
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
    throw new Error(D.values.scenarioValue18);
  };
  try {
    for (const amountVnd of [
      999,
      50000001,
      1000.01,
      NaN,
      Infinity,
      D.values.scenarioValue19,
      D.values.scenarioValue20,
      D.values.scenarioValue21,
      D.values.scenarioValue22,
      D.values.scenarioValue23,
      D.values.scenarioValue24,
    ]) {
      await assert.rejects(client.createCaptureWallet({ ...input, amountVnd }), /Invalid MoMo/);
    }
    assert.equal(calls, D.values.equalScenario16);
    for (const amountVnd of [1000, 50000000, D.values.scenarioValue25, D.values.scenarioValue26])
      await assert.rejects(
        client.createCaptureWallet({ ...input, amountVnd }),
        /transport sentinel/,
      );
    assert.equal(calls, D.values.equalScenario17);
  } finally {
    globalThis.fetch = original;
  }
});

test('optional MoMo configuration does not fail construction/startup and rejects use when unavailable', async () => {
  const disabled = new HttpMomoPaymentClient(loadMomoConfig({}));
  await assert.rejects(disabled.createCaptureWallet(input), /optional channel is unavailable/);
  for (const patch of [
    { partnerCode: D.values.partnerCode5 },
    { accessKey: D.values.accessKey2 },
    { secretKey: D.values.secretKey },
    { ipnUrl: D.values.ipnUrl2 },
    { ipnUrl: D.values.ipnUrl3 },
    { endpoint: D.values.endpoint3 },
    { endpoint: D.values.endpoint4 },
    { endpoint: D.values.endpoint5 },
    { endpoint: D.values.endpoint6 },
    { redirectUrl: D.values.redirectUrl2 },
  ])
    assert.throws(() => requireMomoConfig({ ...config, ...patch }));
});

test('transport, invalid JSON and body-read abort errors propagate without accepting a result', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new DOMException(D.values.scenarioValue27, D.values.scenarioValue28);
    };
    await assert.rejects(client.createCaptureWallet(input), { name: D.values.name });
    globalThis.fetch = async () => new Response(D.values.scenarioValue29);
    await assert.rejects(client.createCaptureWallet(input), MomoVerificationError);
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new DOMException(D.values.scenarioValue30, D.values.scenarioValue31));
          },
        }),
      );
    await assert.rejects(client.createCaptureWallet(input), { name: D.values.name2 });
  } finally {
    globalThis.fetch = original;
  }
});

test('payment-success IPN requires a positive provider transaction identity even when signed', () => {
  assert.equal(client.verifyIpn(fixtures.ipnZeroTransaction), D.values.equalScenario18);
});

test('malformed successful HTTP response is a verification blocker', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(D.values.scenarioValue32, { status: D.values.status2 });
  try {
    await assert.rejects(client.createCaptureWallet(input), (error: unknown) => {
      assert.ok(error instanceof MomoVerificationError);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('dispatch uses immutable callback snapshot and rejects partner/environment changes before HTTP', async () => {
  const snapshot = client.snapshot(input.checkoutId);
  const changed = new HttpMomoPaymentClient({
    ...config,
    ipnUrl: D.values.ipnUrl4,
    redirectUrl: D.values.redirectUrl3,
  });
  let body: Record<string, unknown> = {};
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(fixtures.response.fields));
  };
  try {
    await changed.createCaptureWallet({ ...input, snapshot });
    assert.equal(body.ipnUrl, snapshot.ipnUrl);
    assert.equal(body.redirectUrl, snapshot.redirectUrl);
    assert.equal(body.extraData, snapshot.extraData);
    assert.equal(body.autoCapture, D.values.equalScenario19);
    globalThis.fetch = async () => {
      assert.fail(D.values.failScenario);
    };
    for (const patch of [
      { partnerCode: D.values.partnerCode6 },
      { endpoint: D.values.endpoint7 },
    ]) {
      await assert.rejects(
        new HttpMomoPaymentClient({ ...config, ...patch }).createCaptureWallet({
          ...input,
          snapshot,
        }),
        /snapshot configuration mismatch/,
      );
    }
  } finally {
    globalThis.fetch = original;
  }
});

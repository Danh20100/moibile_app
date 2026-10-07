import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createRequire } from 'node:module';
import { Logger } from '@nestjs/common';
import { ResourceAuthorizationService } from '../../src/common/auth/resource-authorization.service';
import { loadDemoConfig } from '../../src/modules/payment-gateway/demo/demo-config';
import { signDemoCapability } from '../../src/modules/payment-gateway/demo/demo-capability';
import type { GatewayCheckoutRecord } from '../../src/persistence/ports/finance.repository';
import { DemoGatewayAdapter } from '../../src/modules/payment-gateway/providers/demo-gateway.adapter';
import { GatewayProviderRegistry } from '../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { MomoGatewayAdapter } from '../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { HttpMomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { GatewaySettlementService } from '../../src/modules/payment-gateway/services/gateway-settlement.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';
import { startGatewayHttpHarness } from './support/payment-gateway-http-harness';

const actor = '10000000-0000-4000-8000-000000000001';
const tenancyId = '60000000-0000-4000-8000-000000000011';
const initial = new Date('2026-10-07T00:00:00.000Z');
const require = createRequire(__filename);

async function fixture(t: test.TestContext) {
  const tx = createCoreTestTransactionManager({ rollbackGatewayWrites: true });
  await tx.run(async ({ repositories: r }) => {
    await r.organization.createOrganization({
      organizationId: 'org-demo',
      primaryOwnerUserId: actor,
      name: 'Demo',
    });
    await r.property.createProperty({
      propertyId: 'property-demo',
      organizationId: 'org-demo',
      name: 'Property',
      lifecycleStatus: 'ACTIVE',
      operationalAddressText: 'Addr',
      operationalLocation: { longitude: 106.7, latitude: 10.8 },
      publicLocationProjection: { longitude: 106.71, latitude: 10.81 },
    });
    await r.property.createRoom({
      roomId: 'room-demo',
      propertyId: 'property-demo',
      nameOrLabel: 'Room',
      operationalState: 'OCCUPIED',
      recordLifecycle: 'ACTIVE',
    });
    await r.tenancy.createTenancy({
      tenancyId,
      roomId: 'room-demo',
      status: 'ACTIVE',
      startedAt: initial.toISOString(),
      endedAt: null,
      endReason: null,
    });
  });
  let now = initial;
  const settings = {
    NODE_ENV: 'test',
    DEMO_PAYMENT_ENABLED: 'true',
    DEMO_PAYMENT_PUBLIC_BASE_URL: 'http://10.0.2.2:3000',
    DEMO_PAYMENT_SIGNING_KEY: 'nonsecret-demo-http-fixture-key-at-least-32-bytes',
  };
  const config = () => loadDemoConfig(settings);
  const clock = () => now;
  const demo = new DemoGatewayAdapter(clock, config);
  const momo = new MomoGatewayAdapter(
    new HttpMomoPaymentClient({
      partnerCode: '',
      accessKey: '',
      secretKey: '',
      endpoint: 'https://test-payment.momo.vn',
      ipnUrl: '',
      redirectUrl: 'trooi://payment/momo',
    }),
  );
  const gateway = new PaymentGatewayService(
    new TenancyService(tx),
    tx,
    new GatewayProviderRegistry(momo, demo),
    new GatewaySettlementService(tx, clock),
    undefined,
    clock,
  );
  const checkout = await gateway.createCheckout(
    { tenancyId, amount: '1000', provider: 'DEMO' },
    actor,
    randomUUID(),
  );
  assert.ok(checkout.payUrl);
  const token = new URL(checkout.payUrl).pathname.split('/').at(-1)!;
  let accesses = 0;
  const browserTx = {
    run: ((work) => {
      accesses++;
      return tx.run(work);
    }) as typeof tx.run,
  };
  const app = await startGatewayHttpHarness({
    service: gateway,
    authz: new ResourceAuthorizationService(tx),
    verifier: {
      async verify() {
        throw new Error('Public capability routes must not authenticate a principal');
      },
    },
    demo: { tx: browserTx, config, clock },
  });
  t.after(app.close);
  const url = `${app.baseUrl}/finance/checkouts/demo/pay/${token}`;
  const snapshot = () =>
    tx.run(async ({ repositories: r }) => ({
      checkout: await r.finance.findGatewayCheckout(checkout.id),
      payments: await r.finance.findPaymentsForTenancy(tenancyId),
      notifications: await r.notification.findNotificationsByRecipient(actor),
      receipts: await r.finance.findReceiptsForPayment(),
    }));
  const rewrite = async (patch: Partial<GatewayCheckoutRecord>, persist = true) => {
    const before = (await snapshot()).checkout!;
    const record = { ...before, ...patch } as GatewayCheckoutRecord;
    if (persist) await tx.run(({ repositories: r }) => r.finance.updateGatewayCheckout(record));
    const signed = signDemoCapability(record, config()!, now);
    return `${app.baseUrl}/finance/checkouts/demo/pay/${signed}`;
  };
  return {
    tx,
    app,
    checkout,
    token,
    url,
    snapshot,
    settings,
    rewrite,
    accesses: () => accesses,
    advance: () => {
      now = new Date(now.getTime() + 900000);
    },
  };
}

test('demo_handoff_get_is_read_only', async (t) => {
  const f = await fixture(t);
  const before = await f.snapshot();
  const {
    DemoGatewayAdapter: CompiledDemo,
  } = require('../../build/modules/payment-gateway/providers/demo-gateway.adapter');
  const verify = t.mock.method(CompiledDemo.prototype, 'verifyCompletion', () => {
    throw new Error('GET must not mint evidence');
  });
  t.mock.method(PaymentGatewayService.prototype, 'findCheckout', () => {
    throw new Error('GET must not recover a checkout');
  });
  const response = await fetch(f.url);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /text\/html/);
  const html = await response.text();
  assert.match(html, /MÔ PHỎNG/);
  assert.match(html, /Xác nhận thanh toán/);
  assert.match(html, /1000/);
  assert.deepEqual(await f.snapshot(), before);
  assert.equal(before.payments.length, 0);
  assert.equal(verify.mock.callCount(), 0);
});

test('demo_success_creates_one_verified_gateway_payment', async (t) => {
  const f = await fixture(t);
  const response = await fetch(`${f.url}/success`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: '50000000', success: true, checkoutId: randomUUID() }),
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Thanh toán đã được xác nhận/);
  assert.match(html, /MÔ PHỎNG/);
  assert.doesNotMatch(html, /Hóa đơn đã tất toán/);
  assert.ok(!html.includes(f.token));
  const after = await f.snapshot();
  assert.equal(after.payments.length, 1);
  const payment = after.payments[0];
  assert.equal(payment.amount, '1000.00');
  assert.equal(payment.tenancyId, tenancyId);
  assert.equal(payment.source, 'GATEWAY');
  assert.equal(payment.verification, 'PROVIDER_VERIFIED');
  assert.equal(after.checkout?.status, 'SUCCEEDED');
  assert.equal(after.checkout?.resultingPaymentId, payment.paymentId);
  assert.equal(after.checkout?.providerTransId, `DEMO-${f.checkout.id.replace(/-/g, '')}`);
  assert.equal(after.checkout?.providerOutcomeStage, 'DEMO_CONFIRMATION');
  assert.ok(!after.checkout?.terminalEvidence?.includes(f.token));
  assert.equal(after.receipts.length, 0);
  await f.tx.run(async ({ repositories: r }) => {
    assert.equal((await r.finance.findPaymentAllocations(payment.paymentId)).length, 0);
    assert.equal(await r.finance.sumPaymentCommittedAmount(payment.paymentId), '0.00');
  });
});

test('demo_duplicate_success_is_idempotent', async (t) => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.url}/success`, { method: 'POST' })).status, 200);
  const committed = await f.snapshot();
  const response = await fetch(`${f.url}/success`, { method: 'POST' });
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes(f.token));
  assert.deepEqual(await f.snapshot(), committed);
  assert.equal(committed.payments.length, 1);
  const get = await fetch(f.url);
  assert.equal(get.status, 200);
  assert.match(await get.text(), /Thanh toán đã được xác nhận/);
  assert.deepEqual(await f.snapshot(), committed);
});

test('demo_return_or_cancel_never_settles', async (t) => {
  const f = await fixture(t);
  const before = await f.snapshot();
  for (const suffix of ['', '?success=true&amount=50000000', '/success', '/cancel']) {
    const response = await fetch(`${f.url}${suffix}`);
    assert.equal(response.status, suffix.startsWith('/') ? 404 : 200);
    const body = await response.text();
    if (response.status === 200) assert.doesNotMatch(body, /trooi:\/\/payment\/demo/i);
  }
  assert.equal((await fetch(`${f.url}/cancel`, { method: 'POST' })).status, 404);
  assert.deepEqual(await f.snapshot(), before);
});

test('demo_bad_and_expired_capability_rejected_before_lookup', async (t) => {
  const f = await fixture(t);
  const before = await f.snapshot();
  for (const token of [`${f.token}x`, 'invalid', 'x'.repeat(4097)]) {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(
        `${f.app.baseUrl}/finance/checkouts/demo/pay/${token}${method === 'POST' ? '/success' : ''}`,
        { method },
      );
      assert.equal(response.status, 403);
      const body = await response.text();
      assert.ok(!body.includes(token));
      assert.ok(!body.includes('/finance/checkouts/demo/pay/'));
    }
  }
  f.advance();
  for (const method of ['GET', 'POST']) {
    const response = await fetch(`${f.url}${method === 'POST' ? '/success' : ''}`, { method });
    assert.equal(response.status, 403);
    assert.ok(!(await response.text()).includes(f.token));
  }
  assert.equal(f.accesses(), 0);
  assert.deepEqual(await f.snapshot(), before);
});

test('demo_origin_must_exactly_match_when_present', async (t) => {
  const f = await fixture(t);
  for (const origin of [
    'null',
    'https://evil.example',
    'http://10.0.2.2:3000/',
    'http://10.0.2.2:3000.evil.example',
    'http://10.0.2.2:3001',
    '',
  ]) {
    const response = await fetch(`${f.url}/success`, { method: 'POST', headers: { origin } });
    assert.equal(response.status, 403);
    await response.text();
  }
  assert.equal(f.accesses(), 0);
  const response = await fetch(`${f.url}/success`, {
    method: 'POST',
    headers: { origin: f.settings.DEMO_PAYMENT_PUBLIC_BASE_URL },
  });
  assert.equal(response.status, 200);
  assert.equal((await f.snapshot()).payments.length, 1);
});

test('demo_config_lost_after_issuance_is_unavailable_before_lookup', async (t) => {
  const f = await fixture(t);
  const before = await f.snapshot();
  for (const patch of [
    { DEMO_PAYMENT_ENABLED: 'false' },
    { DEMO_PAYMENT_ENABLED: 'true', DEMO_PAYMENT_SIGNING_KEY: '' },
  ]) {
    Object.assign(f.settings, patch);
    for (const method of ['GET', 'POST']) {
      const response = await fetch(`${f.url}${method === 'POST' ? '/success' : ''}`, { method });
      assert.equal(response.status, 503);
      assert.ok(!(await response.text()).includes(f.token));
    }
  }
  assert.equal(f.accesses(), 0);
  assert.deepEqual(await f.snapshot(), before);
});

test('demo_missing_exact_checkout_is_404', async (t) => {
  const f = await fixture(t);
  const missing = await f.rewrite({ checkoutId: randomUUID() }, false);
  for (const method of ['GET', 'POST']) {
    const response = await fetch(`${missing}${method === 'POST' ? '/success' : ''}`, { method });
    assert.equal(response.status, 404);
    await response.text();
  }
  assert.equal((await f.snapshot()).payments.length, 0);
});

test('demo_immutable_and_terminal_conflicts_are_409', async (t) => {
  const f = await fixture(t);
  const original = (await f.snapshot()).checkout!;
  await f.rewrite({ referenceCode: 'tampered' });
  for (const method of ['GET', 'POST']) {
    const response = await fetch(`${f.url}${method === 'POST' ? '/success' : ''}`, { method });
    assert.equal(response.status, 409);
    await response.text();
  }
  const patches: Partial<GatewayCheckoutRecord>[] = [
    { providerPartnerCode: 'wrong' },
    { providerOrderId: 'wrong' },
    { providerRequestId: 'wrong' },
    { idempotencyKey: null },
    { fingerprint: 'wrong' },
    { providerRemoteOrderId: 'wrong' },
    { providerTransId: 'wrong' },
    { status: 'FAILED' },
    { status: 'INITIATED' },
    { status: 'UNKNOWN' },
  ];
  for (const patch of patches) {
    await f.tx.run(({ repositories: r }) => r.finance.updateGatewayCheckout(original));
    const url = await f.rewrite(patch);
    for (const method of ['GET', 'POST']) {
      const response = await fetch(`${url}${method === 'POST' ? '/success' : ''}`, { method });
      assert.equal(response.status, 409);
      await response.text();
    }
  }
  assert.equal((await f.snapshot()).payments.length, 0);
});

test('demo_html_escapes_reference_and_only_form_action_contains_capability', async (t) => {
  const f = await fixture(t);
  const url = await f.rewrite({ referenceCode: '<script>alert("x")</script>&\'"' });
  const token = url.split('/').at(-1)!;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;&quot;'));
  assert.doesNotMatch(html, /<script|<style|<link|<img|<!--|\son\w+=/i);
  const action = `/api/v1/finance/checkouts/demo/pay/${token}/success`;
  assert.ok(html.includes(`action="${action}"`));
  assert.equal(html.split(token).length - 1, 1);
  assert.ok(!html.replace(`action="${action}"`, '').includes(token));
});

test('demo_invalid_stored_amount_is_immutable_conflict', async (t) => {
  const f = await fixture(t);
  const original = (await f.snapshot()).checkout!;
  for (const amount of ['not-an-amount', '999.00', '1000.50']) {
    await f.tx.run(({ repositories: r }) =>
      r.finance.updateGatewayCheckout({ ...original, amount }),
    );
    const before = await f.snapshot();
    for (const method of ['GET', 'POST']) {
      const response = await fetch(`${f.url}${method === 'POST' ? '/success' : ''}`, { method });
      assert.equal(response.status, 409);
      assert.ok(!(await response.text()).includes(f.token));
    }
    assert.deepEqual(await f.snapshot(), before);
  }
});

test('demo_security_headers_on_get_success_and_errors', async (t) => {
  const f = await fixture(t);
  for (const [url, method] of [
    [f.url, 'GET'],
    [`${f.url}/success`, 'POST'],
    [`${f.url}x`, 'GET'],
  ] as const) {
    const response = await fetch(url, { method });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const csp = response.headers.get('content-security-policy')!;
    for (const directive of [
      "default-src 'none'",
      "script-src 'none'",
      "form-action 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ])
      assert.ok(csp.includes(directive));
    await response.text();
  }
});

test('demo_persistence_failure_is_generic_500_without_token_in_errors_or_logs', async (t) => {
  const f = await fixture(t);
  const logs: unknown[] = [];
  t.mock.method(Logger.prototype, 'error', (...args: unknown[]) => {
    logs.push(args);
  });
  await f.tx.run(async ({ repositories: r }) => {
    t.mock.method(r.finance, 'findGatewayCheckout', async () => {
      throw new Error(`Persistence failed ${f.url}`);
    });
  });
  for (const method of ['GET', 'POST']) {
    const response = await fetch(`${f.url}${method === 'POST' ? '/success' : ''}`, { method });
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.match(body, /Internal server error/);
    assert.ok(!body.includes(f.token));
    assert.ok(!body.includes('Persistence failed'));
  }
  assert.ok(!JSON.stringify(logs).includes(f.token));
});

test('demo_settlement_persistence_failure_never_renders_success', async (t) => {
  const f = await fixture(t);
  const before = await f.snapshot();
  await f.tx.run(async ({ repositories: r }) => {
    t.mock.method(r.finance, 'updateGatewayCheckout', async () => {
      throw new Error(`Write failed ${f.token}`);
    });
  });
  const response = await fetch(`${f.url}/success`, { method: 'POST' });
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.match(body, /Internal server error/);
  assert.doesNotMatch(body, /Thanh toán đã được xác nhận/);
  assert.ok(!body.includes(f.token));
  assert.deepEqual(await f.snapshot(), before);
});

test('demo_parser_and_pre_controller_errors_redact_capability_and_query', async (t) => {
  const f = await fixture(t);
  const logs: unknown[] = [];
  t.mock.method(Logger.prototype, 'error', (...args: unknown[]) => {
    logs.push(args);
  });
  const cases = [
    {
      url: `${f.url}/success?secret=${f.token}`,
      method: 'POST',
      body: `{"secret":"${f.token}",oops}`,
      status: 400,
    },
    {
      url: `${f.url}/success?secret=${f.token}`,
      method: 'POST',
      body: JSON.stringify({ secret: f.token, data: 'x'.repeat(110000) }),
      status: 413,
    },
    { url: `${f.url}/cancel?secret=${f.token}`, method: 'POST', body: undefined, status: 404 },
    {
      url: `${f.app.baseUrl}/finance/checkouts/demo/pay/%E0%A4%A/success?secret=${f.token}`,
      method: 'POST',
      body: undefined,
      status: 400,
    },
  ];
  for (const [index, item] of cases.entries()) {
    const response = await fetch(item.url, {
      method: item.method,
      headers: { 'content-type': 'application/json' },
      body: item.body,
    });
    assert.equal(response.status, item.status, `parser/pre-controller case ${index}`);
    const body = await response.text();
    assert.ok(!body.includes(f.token), `token redaction case ${index}`);
    assert.ok(!body.includes('secret'), `query redaction case ${index}`);
    assert.ok(!body.includes('%E0%A4%A'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  }
  assert.equal(f.accesses(), 0);
  assert.ok(!JSON.stringify(logs).includes(f.token));
});

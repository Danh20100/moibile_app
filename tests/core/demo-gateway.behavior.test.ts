import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';
import { loadDemoConfig } from '../../src/modules/payment-gateway/demo/demo-config';
import { demoIntentDigest, signDemoCapability, verifyDemoCapability } from '../../src/modules/payment-gateway/demo/demo-capability';
import { DemoGatewayAdapter } from '../../src/modules/payment-gateway/providers/demo-gateway.adapter';
import { GatewayProviderRegistry } from '../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { MomoGatewayAdapter } from '../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { HttpMomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
import { VerifiedGatewayEvidence } from '../../src/modules/payment-gateway/providers/gateway-provider';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { GatewaySettlementService } from '../../src/modules/payment-gateway/services/gateway-settlement.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import type { GatewayCheckoutRecord } from '../../src/persistence/ports/finance.repository';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const actor = '10000000-0000-4000-8000-000000000001';
const tenancyId = '60000000-0000-4000-8000-000000000011';
const input = { tenancyId, amount: '1000', provider: 'DEMO' as const };
const env = { NODE_ENV: 'test', DEMO_PAYMENT_ENABLED: 'true', DEMO_PAYMENT_PUBLIC_BASE_URL: 'http://10.0.2.2:3000/', DEMO_PAYMENT_SIGNING_KEY: 'nonsecret-demo-fixture-key-32-bytes-minimum' };
const config = { publicBaseUrl: 'http://10.0.2.2:3000', signingKey: env.DEMO_PAYMENT_SIGNING_KEY };
const initial = new Date('2026-10-07T00:00:00.000Z');

async function fixture() {
  const tx = createCoreTestTransactionManager();
  await tx.run(async ({ repositories: r }) => {
    await r.organization.createOrganization({ organizationId: 'org-demo', primaryOwnerUserId: actor, name: 'Demo' });
    await r.property.createProperty({ propertyId: 'property-demo', organizationId: 'org-demo', name: 'Property', lifecycleStatus: 'ACTIVE', operationalAddressText: 'Addr', operationalLocation: { longitude: 106.7, latitude: 10.8 }, publicLocationProjection: { longitude: 106.71, latitude: 10.81 } });
    await r.property.createRoom({ roomId: 'room-demo', propertyId: 'property-demo', nameOrLabel: 'Room', operationalState: 'OCCUPIED', recordLifecycle: 'ACTIVE' });
    await r.tenancy.createTenancy({ tenancyId, roomId: 'room-demo', status: 'ACTIVE', startedAt: initial.toISOString(), endedAt: null, endReason: null });
  });
  let now = initial;
  const settings = { ...env };
  const clock = () => now;
  const demo = new DemoGatewayAdapter(clock, () => loadDemoConfig(settings));
  const momo = new MomoGatewayAdapter(new HttpMomoPaymentClient({ partnerCode: '', accessKey: '', secretKey: '', endpoint: 'https://test-payment.momo.vn', ipnUrl: '', redirectUrl: 'trooi://payment/momo' }));
  const registry = new GatewayProviderRegistry(momo, demo);
  const settlement = new GatewaySettlementService(tx, clock);
  const gateway = new PaymentGatewayService(new TenancyService(tx), tx, registry, settlement, undefined, clock);
  const row = async (id: string) => {
    const value = await tx.run(({ repositories: r }) => r.finance.findGatewayCheckout(id));
    assert.ok(value);
    return value;
  };
  const payments = () => tx.run(({ repositories: r }) => r.finance.findPaymentsForTenancy(tenancyId));
  return { tx, demo, gateway, settlement, row, payments, settings, advance: () => { now = new Date(now.getTime() + 900000); } };
}

function tokenOf(url: string | undefined): string {
  assert.ok(url);
  return new URL(url).pathname.split('/').at(-1)!;
}

function signedJson(value: unknown): string {
  const payload = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
  return `${payload}.${createHmac('sha256', config.signingKey).update(payload).digest('base64url')}`;
}

test('demo_provider_disabled_by_default', () => {
  assert.equal(loadDemoConfig({}), null);
  assert.equal(loadDemoConfig({ ...env, DEMO_PAYMENT_ENABLED: 'false' }), null);
});

test('demo_provider_rejected_in_production', () => {
  assert.equal(loadDemoConfig({ ...env, NODE_ENV: 'production' }), null);
});

test('demo_config_accepts_only_configured_safe_origins', () => {
  for (const origin of ['https://demo.example', 'http://localhost:3000', 'http://127.0.0.1', 'http://10.0.2.2:3000', 'http://[::1]:3000', 'http://[0:0:0:0:0:0:0:1]']) {
    assert.ok(loadDemoConfig({ ...env, DEMO_PAYMENT_PUBLIC_BASE_URL: origin }), origin);
  }
  assert.deepEqual(loadDemoConfig(env), config);
  for (const origin of ['', ' http://localhost', 'http://localhost ', 'http://demo.example', 'http://localhost.evil', 'https://user:pass@demo.example', 'https://demo.example/path', 'https://demo.example?x', 'https://demo.example#x', 'ftp://localhost', 'https://demo.example/?', 'https://demo.example/#']) {
    assert.equal(loadDemoConfig({ ...env, DEMO_PAYMENT_PUBLIC_BASE_URL: origin }), null, origin);
  }
  for (const key of ['', 'short', ' '.repeat(32)]) assert.equal(loadDemoConfig({ ...env, DEMO_PAYMENT_SIGNING_KEY: key }), null);
});

test('demo_checkout_uses_shared_gateway_boundary', async () => {
  const f = await fixture();
  const key = randomUUID();
  const checkout = await f.gateway.createCheckout(input, actor, key);
  const record = await f.row(checkout.id);
  assert.equal(checkout.status, 'CREATED');
  assert.equal(checkout.provider, 'DEMO');
  assert.equal(checkout.amount, '1000.00');
  assert.equal(record.requestSnapshot, null);
  assert.equal(record.providerRemoteOrderId, null);
  assert.equal(record.providerPartnerCode, 'demo:local');
  assert.equal(record.providerOrderId, `TROOI-DEMO-${checkout.id.replace(/-/g, '')}`);
  assert.equal(record.providerRequestId, `DEMO-REQ-${checkout.id.replace(/-/g, '')}`);
  assert.equal(record.fingerprint, createHash('sha256').update(JSON.stringify(['DEMO', tenancyId, 1000])).digest('hex'));
  assert.equal((await f.payments()).length, 0);
  assert.equal(checkout.payUrl, `${config.publicBaseUrl}/api/v1/finance/checkouts/demo/pay/${tokenOf(checkout.payUrl)}`);
  assert.deepEqual(await f.gateway.createCheckout({ ...input, amount: '1000.00' }, actor, key.toUpperCase()), checkout);
  const evidence = f.demo.verifyCompletion(tokenOf(checkout.payUrl), record);
  assert.ok(VerifiedGatewayEvidence.isVerified(evidence));
  assert.ok(Object.isFrozen(evidence.data));
  assert.equal(evidence.data.providerSettlementId, `DEMO-${checkout.id.replace(/-/g, '')}`);
  assert.equal(evidence.data.stage, 'DEMO_CONFIRMATION');
  assert.equal(evidence.data.resultCode, null);
  assert.equal(evidence.data.snapshot, 'null');
  assert.ok(!evidence.data.observation.includes(tokenOf(checkout.payUrl)));
  await f.settlement.settle(evidence);
  await f.settlement.settle(f.demo.verifyCompletion(tokenOf(checkout.payUrl), await f.row(checkout.id)));
  assert.equal((await f.payments()).length, 1);
  const terminal = await f.row(checkout.id);
  assert.equal((await f.gateway.createCheckout(input, actor, key)).status, 'SUCCEEDED');
  assert.deepEqual(await f.row(checkout.id), terminal);
});

test('demo_tampered_or_expired_capability_never_settles', async () => {
  const f = await fixture();
  const checkout = await f.gateway.createCheckout(input, actor, randomUUID());
  const record = await f.row(checkout.id);
  const token = tokenOf(checkout.payUrl);
  assert.throws(() => f.demo.verifyCompletion(`${token}x`, record));
  f.advance();
  assert.throws(() => f.demo.verifyCompletion(token, record));
  assert.equal((await f.payments()).length, 0);
  assert.equal((await f.row(checkout.id)).status, 'CREATED');
});

test('demo_capability_rejects_wrong_purpose_provider_key_digest_id_expiry_and_noncanonical_json', async () => {
  const f = await fixture();
  const checkout = await f.gateway.createCheckout(input, actor, randomUUID());
  const record = await f.row(checkout.id);
  const token = tokenOf(checkout.payUrl);
  const payload = f.demo.readCapability(token);
  assert.equal(payload.exp, Math.floor(initial.getTime() / 1000) + 900);
  assert.equal(token, signedJson({ version: 1, provider: 'DEMO', purpose: 'demo-confirm', checkoutId: checkout.id, exp: payload.exp, intentDigest: demoIntentDigest(record) }));
  assert.equal(signDemoCapability(record, config, initial), token);
  assert.ok(!VerifiedGatewayEvidence.isVerified(payload));
  for (const patch of [{ version: 2 }, { purpose: 'payment-ipn' }, { provider: 'MOMO' }, { checkoutId: 'bad' }, { checkoutId: checkout.id.toUpperCase() }, { exp: 1 }, { exp: payload.exp + 0.5 }, { intentDigest: 'bad' }, { extra: true }]) {
    assert.throws(() => verifyDemoCapability(signedJson({ ...payload, ...patch }), config, initial));
  }
  assert.throws(() => verifyDemoCapability(token, { ...config, signingKey: 'different-nonsecret-key-for-tests' }, initial));
  assert.throws(() => f.demo.verifyCompletion(signedJson({ ...payload, checkoutId: randomUUID() }), record));
  assert.throws(() => f.demo.verifyCompletion(signedJson({ ...payload, intentDigest: '0'.repeat(64) }), record));
  for (const json of [JSON.stringify(payload, null, 2), JSON.stringify({ ...payload, version: undefined }), JSON.stringify(payload).replace('"version":1', '"version":1,"version":1'), JSON.stringify(Object.fromEntries(Object.entries(payload).reverse()))]) {
    assert.throws(() => verifyDemoCapability(signedJson(json), config, initial));
  }
  for (const malformed of ['', 'x'.repeat(4097), `${token}=`, token.replace('.', '..')]) assert.throws(() => f.demo.readCapability(malformed));
});

test('demo_intent_digest_binds_every_immutable_field_and_verifier_checks_local_identity', async () => {
  const f = await fixture();
  const checkout = await f.gateway.createCheckout(input, actor, randomUUID());
  const record = await f.row(checkout.id);
  const token = tokenOf(checkout.payUrl);
  const mutations = { checkoutId: randomUUID(), tenancyId: randomUUID(), createdByUserId: randomUUID(), amount: '2000.00', referenceCode: 'other', provider: 'SEPAY', providerPartnerCode: 'other', providerOrderId: 'other', providerRequestId: 'other', idempotencyKey: randomUUID(), fingerprint: '0'.repeat(64), createdAt: '2026-10-06T00:00:00.000Z', requestSnapshot: {}, providerRemoteOrderId: 'remote' };
  for (const [field, value] of Object.entries(mutations)) {
    const changed = { ...record, [field]: value } as GatewayCheckoutRecord;
    assert.notEqual(demoIntentDigest(changed), demoIntentDigest(record), field);
    assert.throws(() => f.demo.verifyCompletion(token, changed), field);
  }
  for (const patch of [{ providerPartnerCode: 'other' }, { providerOrderId: 'other' }, { providerRequestId: 'other' }, { fingerprint: null }, { idempotencyKey: null }, { status: 'INITIATED' }, { status: 'FAILED' }]) {
    const changed = { ...record, ...patch } as GatewayCheckoutRecord;
    assert.throws(() => f.demo.verifyCompletion(signDemoCapability(changed, config, initial), changed));
  }
});

test('demo_generic_callbacks_cannot_mint_evidence', async () => {
  const f = await fixture();
  const checkout = await f.gateway.createCheckout(input, actor, randomUUID());
  assert.throws(() => f.demo.authenticateNotification({ resultCode: 0 }));
  await assert.rejects(f.demo.verifyNotification({}, await f.row(checkout.id)));
  await assert.rejects(f.settlement.settle({ data: {} } as VerifiedGatewayEvidence));
  assert.equal((await f.payments()).length, 0);
});

test('sepay_remains_unavailable', async () => {
  const f = await fixture();
  await assert.rejects(f.gateway.createCheckout({ ...input, provider: 'SEPAY' }, actor, randomUUID()), /SEPAY.*unavailable/);
});

test('omitted_provider_remains_momo', async () => {
  const f = await fixture();
  await assert.rejects(f.gateway.createCheckout({ tenancyId, amount: '1000' }, actor, randomUUID()), /MoMo optional channel is unavailable/);
});

test('demo_renewal_and_key_rotation_preserve_intent_without_money_writes', async () => {
  const f = await fixture();
  const key = randomUUID();
  const first = await f.gateway.createCheckout(input, actor, key);
  const original = await f.row(first.id);
  f.advance();
  const renewed = await f.gateway.createCheckout(input, actor, key);
  assert.equal(renewed.id, first.id);
  assert.notEqual(renewed.payUrl, first.payUrl);
  assert.equal(demoIntentDigest(await f.row(first.id)), demoIntentDigest(original));
  f.settings.DEMO_PAYMENT_SIGNING_KEY += '-rotated';
  assert.throws(() => f.demo.readCapability(tokenOf(renewed.payUrl)));
  const rotated = await f.gateway.createCheckout(input, actor, key);
  assert.notEqual(rotated.payUrl, renewed.payUrl);
  assert.equal(rotated.id, first.id);
  assert.equal(demoIntentDigest(await f.row(first.id)), demoIntentDigest(original));
  assert.equal((await f.payments()).length, 0);
});

test('demo_config_loss_blocks_dispatch_and_confirmation_but_keeps_history_and_conflict_order', async () => {
  const f = await fixture();
  const key = randomUUID();
  const checkout = await f.gateway.createCheckout(input, actor, key);
  const before = await f.row(checkout.id);
  f.settings.DEMO_PAYMENT_ENABLED = 'false';
  const replay = await f.gateway.createCheckout(input, actor, key);
  assert.equal(replay.replayBlockedReason, 'PROVIDER_UNAVAILABLE');
  assert.equal((await f.gateway.findCheckout(checkout.id, actor)).id, checkout.id);
  assert.throws(() => f.demo.verifyCompletion(tokenOf(checkout.payUrl), before));
  await assert.rejects(f.gateway.createCheckout(input, actor, randomUUID()), /DEMO.*unavailable/);
  await assert.rejects(f.gateway.createCheckout({ ...input, amount: '2000' }, actor, key), /payload differs/);
  await assert.rejects(f.gateway.createCheckout({ ...input, provider: 'SEPAY' }, actor, key), /payload differs/);
  assert.deepEqual(await f.row(checkout.id), before);
});

test('demo_interrupted_dispatch_resumes_after_lease_and_late_renewal_cannot_overwrite_settlement', async () => {
  const f = await fixture();
  const key = randomUUID();
  const first = await f.gateway.createCheckout(input, actor, key);
  const original = await f.row(first.id);
  await f.tx.run(({ repositories: r }) => r.finance.updateGatewayCheckout({ ...original, status: 'INITIATED', payUrl: null, dispatchLeaseOwner: randomUUID(), dispatchLeaseUntil: new Date(initial.getTime() + 60000).toISOString() }));
  assert.equal((await f.gateway.createCheckout(input, actor, key)).replayBlockedReason, 'DISPATCH_IN_PROGRESS');
  f.advance();
  const resumed = await f.gateway.createCheckout(input, actor, key);
  assert.equal(resumed.id, first.id);
  assert.equal(resumed.status, 'CREATED');
  const evidence = f.demo.verifyCompletion(tokenOf(resumed.payUrl), await f.row(first.id));
  f.advance();
  const handoff = f.demo.prepareHandoff.bind(f.demo);
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const paused = new Promise<void>((resolve) => { release = resolve; });
  f.demo.prepareHandoff = async (record) => { started(); await paused; return handoff(record); };
  const renewal = f.gateway.createCheckout(input, actor, key);
  await entered;
  assert.equal((await f.gateway.createCheckout(input, actor, key)).replayBlockedReason, 'DISPATCH_IN_PROGRESS');
  await f.settlement.settle(evidence);
  const terminal = await f.row(first.id);
  release();
  assert.equal((await renewal).status, 'SUCCEEDED');
  assert.deepEqual(await f.row(first.id), terminal);
  assert.equal((await f.payments()).length, 1);
});

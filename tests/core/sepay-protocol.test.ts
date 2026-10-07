import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import fixtures from './fixtures/sepay-signed-fields.json';
import {
  sepayFormRaw,
  signSepayFields,
  SEPAY_SANDBOX_CHECKOUT_URL,
  SEPAY_SANDBOX_API_ORIGIN,
} from '../../src/modules/payment-gateway/sepay/sepay-form';
import { loadSepayConfig } from '../../src/modules/payment-gateway/sepay/sepay-config';
import { GatewayProviderRegistry } from '../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { MomoGatewayAdapter } from '../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { HttpMomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
import { VerifiedGatewayEvidence } from '../../src/modules/payment-gateway/providers/gateway-provider';
import { GatewaySettlementService } from '../../src/modules/payment-gateway/services/gateway-settlement.service';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const structuralEnv = {
  SEPAY_ENABLED: 'true',
  SEPAY_ENVIRONMENT: 'sandbox',
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://nonsecret:nonsecret@database.example/trooi_sandbox',
  SEPAY_MERCHANT_ID: 'NONSECRET-MERCHANT',
  SEPAY_SECRET_KEY: 'NONSECRET-FORM-KEY',
  SEPAY_IPN_SECRET_KEY: 'NONSECRET-EXPLICIT-IPN-KEY',
  SEPAY_HANDOFF_SIGNING_KEY: 'NONSECRET-SEPARATE-HANDOFF-KEY',
  SEPAY_PUBLIC_BASE_URL: 'https://merchant.example',
};

function disabledRegistry() {
  return new GatewayProviderRegistry(
    new MomoGatewayAdapter(
      new HttpMomoPaymentClient({
        partnerCode: '',
        accessKey: '',
        secretKey: '',
        endpoint: 'https://test-payment.momo.vn',
        ipnUrl: '',
        redirectUrl: 'trooi://payment/momo',
      }),
    ),
  );
}

test('ordered_form_matches_independent_hmac', () => {
  assert.equal(sepayFormRaw(fixtures.ordered.fields), fixtures.ordered.canonical);
  assert.equal(
    signSepayFields(fixtures.ordered.fields, fixtures.secret),
    fixtures.ordered.signature,
  );
});

test('custom_data_and_unknown_fields_are_unsigned_and_cannot_authenticate_correlation', () => {
  const fields = {
    ...fixtures.ordered.fields,
    custom_data: 'untrusted-checkout-id',
    signature: 'untrusted-signature',
    providerSettlementId: 'untrusted-payment',
    ignored_null: null,
  };
  assert.equal(sepayFormRaw(fields), fixtures.ordered.canonical);
  assert.equal(signSepayFields(fields, fixtures.secret), fixtures.ordered.signature);
});

test('insertion_order_matters_and_wrong_secret_differs', () => {
  assert.equal(sepayFormRaw(fixtures.reversed.fields), fixtures.reversed.canonical);
  assert.equal(
    signSepayFields(fixtures.reversed.fields, fixtures.secret),
    fixtures.reversed.signature,
  );
  assert.notEqual(fixtures.reversed.signature, fixtures.ordered.signature);
  assert.notEqual(
    signSepayFields(fixtures.ordered.fields, 'OTHER_NONSECRET'),
    fixtures.ordered.signature,
  );
});

test('undefined_is_omitted_and_null_is_empty_only_for_signed_sdk_fields', () => {
  const fields = { ...fixtures.nullAndEmpty.fields, success_url: undefined, custom_data: null };
  assert.equal(sepayFormRaw(fields), fixtures.nullAndEmpty.canonical);
  assert.equal(signSepayFields(fields, fixtures.secret), fixtures.nullAndEmpty.signature);
  assert.equal(
    signSepayFields({ ...fields, env: '' }, fixtures.secret),
    fixtures.nullAndEmpty.signature,
  );
  assert.notEqual(
    signSepayFields({ ...fields, env: undefined }, fixtures.secret),
    fixtures.nullAndEmpty.signature,
  );
  assert.equal(sepayFormRaw({ custom_data: null, other: undefined }), '');
});

test('all_pinned_sdk_signed_fields_match_independent_literal_without_authorizing_agreements', () => {
  assert.equal(sepayFormRaw(fixtures.allowlist.fields), fixtures.allowlist.canonical);
  assert.equal(
    signSepayFields(fixtures.allowlist.fields, fixtures.secret),
    fixtures.allowlist.signature,
  );
});

test('unicode_delimiters_quotes_ampersand_are_local_utf8_only_transport_unverified', () => {
  assert.equal(sepayFormRaw(fixtures.rawUtf8.fields), fixtures.rawUtf8.canonical);
  assert.equal(
    signSepayFields(fixtures.rawUtf8.fields, fixtures.secret),
    fixtures.rawUtf8.signature,
  );
});

test('config_is_lazy_and_missing_or_disabled_configuration_is_unavailable', () => {
  assert.equal(loadSepayConfig({}), null);
  assert.equal(loadSepayConfig({ SEPAY_ENABLED: 'false', DATABASE_URL: 'invalid' }), null);
  assert.equal(loadSepayConfig({ SEPAY_ENABLED: 'true' }), null);
});

test('config_checks_only_local_sandbox_database_and_origin_structure_without_connections', () => {
  const config = loadSepayConfig(structuralEnv);
  assert.ok(config);
  assert.equal(config.publicBaseUrl, 'https://merchant.example');
  assert.equal(SEPAY_SANDBOX_CHECKOUT_URL, 'https://pay-sandbox.sepay.vn/v1/checkout/init');
  assert.equal(SEPAY_SANDBOX_API_ORIGIN, 'https://pgapi-sandbox.sepay.vn');
  assert.ok(
    loadSepayConfig({
      ...structuralEnv,
      DATABASE_URL: 'postgresql://database.example/%74rooi_sandbox',
    }),
  );
  assert.ok(
    loadSepayConfig({
      ...structuralEnv,
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://database.example/trooi_test',
    }),
  );
  for (const overrides of [
    { NODE_ENV: 'production' },
    { SEPAY_ENVIRONMENT: 'production' },
    { SEPAY_ENABLED: 'TRUE' },
    { DATABASE_URL: 'postgresql://database.example/trooi_dev' },
    { DATABASE_URL: 'postgresql://database.example/trooi_test' },
    { DATABASE_URL: 'https://database.example/trooi_sandbox' },
    { DATABASE_URL: 'postgresql://database.example/%ZZ' },
    { DATABASE_URL: 'postgresql://database.example/trooi_sandbox%2Fother' },
    { SEPAY_MERCHANT_ID: '' },
    { SEPAY_SECRET_KEY: ' ' },
    { SEPAY_IPN_SECRET_KEY: '' },
    { SEPAY_HANDOFF_SIGNING_KEY: '' },
    { SEPAY_HANDOFF_SIGNING_KEY: structuralEnv.SEPAY_SECRET_KEY },
    { SEPAY_HANDOFF_SIGNING_KEY: structuralEnv.SEPAY_IPN_SECRET_KEY },
    { SEPAY_PUBLIC_BASE_URL: 'http://merchant.example' },
    { SEPAY_PUBLIC_BASE_URL: 'https://user:pass@merchant.example' },
    { SEPAY_PUBLIC_BASE_URL: 'https://merchant.example:8443' },
    { SEPAY_PUBLIC_BASE_URL: 'https://merchant.example/path' },
    { SEPAY_PUBLIC_BASE_URL: 'https://merchant.example?query=x' },
    { SEPAY_PUBLIC_BASE_URL: 'https://merchant.example#fragment' },
    { SEPAY_PUBLIC_BASE_URL: 'invalid' },
  ])
    assert.equal(loadSepayConfig({ ...structuralEnv, ...overrides }), null);
  // Presence of explicit IPN input is structural, not proof of its provider relationship.
  assert.ok(
    loadSepayConfig({ ...structuralEnv, SEPAY_IPN_SECRET_KEY: structuralEnv.SEPAY_SECRET_KEY }),
  );
});

test('valid_structural_config_never_enables_any_blocked_sepay_capability', () => {
  assert.ok(loadSepayConfig(structuralEnv));
  const registry = disabledRegistry();
  assert.equal(registry.find('SEPAY'), null);
  assert.ok(registry.find('MOMO'));
  // No adapter exists: every supported or future operation stops at the same registry gate.
  for (const operation of [
    'prepareIntent',
    'prepareHandoff',
    'authenticateNotification',
    'verifyNotification',
    'readOrder',
    'reconcile',
    'resume',
    'dispatch',
  ]) {
    assert.throws(
      () => registry.require('SEPAY'),
      (error: unknown) => error instanceof ServiceUnavailableException && error.getStatus() === 503,
      operation,
    );
  }
});

test('local_forms_config_and_untrusted_callbacks_cannot_produce_verified_evidence_or_settle', async () => {
  const transactions = createCoreTestTransactionManager();
  const settlement = new GatewaySettlementService(transactions);
  const inputs = [
    loadSepayConfig(structuralEnv),
    sepayFormRaw(fixtures.ordered.fields),
    signSepayFields(fixtures.ordered.fields, fixtures.secret),
    {
      provider: 'SEPAY',
      event: 'ORDER_PAID',
      order_status: 'CAPTURED',
      custom_data: 'untrusted-checkout',
      providerSettlementId: 'untrusted-id',
    },
  ];
  for (const input of inputs) {
    assert.equal(VerifiedGatewayEvidence.isVerified(input), false);
    // @ts-expect-error External values cannot satisfy the nominal verified evidence boundary.
    await assert.rejects(settlement.settle(input), /Internally verified gateway evidence required/);
  }
});

test('sepay_checkout_503_never_calls_settlement_or_writes_checkout_or_money', async (context) => {
  const transactions = createCoreTestTransactionManager();
  const userId = '10000000-0000-4000-8000-000000000001';
  const tenancyId = '60000000-0000-4000-8000-000000000001';
  await transactions.run(async ({ repositories }) => {
    await repositories.organization.createOrganization({
      organizationId: 'org-local',
      primaryOwnerUserId: userId,
      name: 'Local test',
    });
    await repositories.property.createProperty({
      propertyId: 'property-local',
      organizationId: 'org-local',
      name: 'Local test',
      lifecycleStatus: 'ACTIVE',
      operationalAddressText: 'Local',
      operationalLocation: { longitude: 106, latitude: 10 },
      publicLocationProjection: { longitude: 106, latitude: 10 },
    });
    await repositories.property.createRoom({
      roomId: 'room-local',
      propertyId: 'property-local',
      nameOrLabel: 'Local',
      operationalState: 'OCCUPIED',
      recordLifecycle: 'ACTIVE',
    });
    await repositories.tenancy.createTenancy({
      tenancyId,
      roomId: 'room-local',
      status: 'ACTIVE',
      startedAt: '2026-10-01T00:00:00.000Z',
      endedAt: null,
      endReason: null,
    });
  });
  const settlement = new GatewaySettlementService(transactions);
  const settlementSpy = context.mock.method(settlement, 'settle');
  const gateway = new PaymentGatewayService(
    new TenancyService(transactions),
    transactions,
    disabledRegistry(),
    settlement,
  );
  const key = '90000000-0000-4000-8000-000000000001';
  await assert.rejects(
    gateway.createCheckout({ tenancyId, amount: '1000', provider: 'SEPAY' }, userId, key),
    (error: unknown) => error instanceof ServiceUnavailableException && error.getStatus() === 503,
  );
  assert.equal(settlementSpy.mock.callCount(), 0);
  await transactions.run(async ({ repositories }) => {
    assert.equal(await repositories.finance.findGatewayCheckoutByClientKey(userId, key), undefined);
    assert.deepEqual(await repositories.finance.findPaymentsForTenancy(tenancyId), []);
  });
});

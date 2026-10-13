import { data as D } from '../support/sepay-protocol-fixtures';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import type fixturesType from '../fixtures/payment/sepay-signed-fields.json';
import { loadFixture } from '../support/fixture-loader';
const fixtures = loadFixture<typeof fixturesType>('payment/sepay-signed-fields');
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
  SEPAY_ENABLED: D.values.SEPAYENABLED,
  SEPAY_ENVIRONMENT: D.values.SEPAYENVIRONMENT,
  NODE_ENV: D.values.NODEENV,
  DATABASE_URL: D.values.DATABASEURL,
  SEPAY_MERCHANT_ID: D.values.SEPAYMERCHANTID,
  SEPAY_SECRET_KEY: D.values.SEPAYSECRETKEY,
  SEPAY_IPN_SECRET_KEY: D.values.SEPAYIPNSECRETKEY,
  SEPAY_HANDOFF_SIGNING_KEY: D.values.SEPAYHANDOFFSIGNINGKEY,
  SEPAY_PUBLIC_BASE_URL: D.values.SEPAYPUBLICBASEURL,
};

function disabledRegistry() {
  return new GatewayProviderRegistry(
    new MomoGatewayAdapter(
      new HttpMomoPaymentClient({
        partnerCode: D.values.partnerCode,
        accessKey: D.values.accessKey,
        secretKey: D.values.secretKey,
        endpoint: D.values.endpoint,
        ipnUrl: D.values.ipnUrl,
        redirectUrl: D.values.redirectUrl,
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
    custom_data: D.values.customdata,
    signature: D.values.signature,
    providerSettlementId: D.values.providerSettlementId,
    ignored_null: D.values.ignorednull,
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
    signSepayFields(fixtures.ordered.fields, D.values.signSepayFieldsScenario),
    fixtures.ordered.signature,
  );
});

test('undefined_is_omitted_and_null_is_empty_only_for_signed_sdk_fields', () => {
  const fields = {
    ...fixtures.nullAndEmpty.fields,
    success_url: undefined,
    custom_data: D.values.customdata2,
  };
  assert.equal(sepayFormRaw(fields), fixtures.nullAndEmpty.canonical);
  assert.equal(signSepayFields(fields, fixtures.secret), fixtures.nullAndEmpty.signature);
  assert.equal(
    signSepayFields({ ...fields, env: D.values.env }, fixtures.secret),
    fixtures.nullAndEmpty.signature,
  );
  assert.notEqual(
    signSepayFields({ ...fields, env: undefined }, fixtures.secret),
    fixtures.nullAndEmpty.signature,
  );
  assert.equal(
    sepayFormRaw({ custom_data: D.values.customdata3, other: undefined }),
    D.values.equalScenario,
  );
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
  assert.equal(loadSepayConfig({}), D.values.equalScenario2);
  assert.equal(
    loadSepayConfig({ SEPAY_ENABLED: D.values.SEPAYENABLED2, DATABASE_URL: D.values.DATABASEURL2 }),
    D.values.equalScenario3,
  );
  assert.equal(loadSepayConfig({ SEPAY_ENABLED: D.values.SEPAYENABLED3 }), D.values.equalScenario4);
});

test('config_checks_only_local_sandbox_database_and_origin_structure_without_connections', () => {
  const config = loadSepayConfig(structuralEnv);
  assert.ok(config);
  assert.equal(config.publicBaseUrl, D.values.equalScenario5);
  assert.equal(SEPAY_SANDBOX_CHECKOUT_URL, D.values.equalScenario6);
  assert.equal(SEPAY_SANDBOX_API_ORIGIN, D.values.equalScenario7);
  assert.ok(
    loadSepayConfig({
      ...structuralEnv,
      DATABASE_URL: D.values.DATABASEURL3,
    }),
  );
  assert.ok(
    loadSepayConfig({
      ...structuralEnv,
      NODE_ENV: D.values.NODEENV2,
      DATABASE_URL: D.values.DATABASEURL4,
    }),
  );
  for (const overrides of [
    { NODE_ENV: D.values.NODEENV3 },
    { SEPAY_ENVIRONMENT: D.values.SEPAYENVIRONMENT2 },
    { SEPAY_ENABLED: D.values.SEPAYENABLED4 },
    { DATABASE_URL: D.values.DATABASEURL5 },
    { DATABASE_URL: D.values.DATABASEURL6 },
    { DATABASE_URL: D.values.DATABASEURL7 },
    { DATABASE_URL: D.values.DATABASEURL8 },
    { DATABASE_URL: D.values.DATABASEURL9 },
    { SEPAY_MERCHANT_ID: D.values.SEPAYMERCHANTID2 },
    { SEPAY_SECRET_KEY: D.values.SEPAYSECRETKEY2 },
    { SEPAY_IPN_SECRET_KEY: D.values.SEPAYIPNSECRETKEY2 },
    { SEPAY_HANDOFF_SIGNING_KEY: D.values.SEPAYHANDOFFSIGNINGKEY2 },
    { SEPAY_HANDOFF_SIGNING_KEY: structuralEnv.SEPAY_SECRET_KEY },
    { SEPAY_HANDOFF_SIGNING_KEY: structuralEnv.SEPAY_IPN_SECRET_KEY },
    { SEPAY_PUBLIC_BASE_URL: D.values.SEPAYPUBLICBASEURL2 },
    { SEPAY_PUBLIC_BASE_URL: D.values.SEPAYPUBLICBASEURL3 },
    { SEPAY_PUBLIC_BASE_URL: D.values.SEPAYPUBLICBASEURL4 },
    { SEPAY_PUBLIC_BASE_URL: D.values.SEPAYPUBLICBASEURL5 },
    { SEPAY_PUBLIC_BASE_URL: D.values.SEPAYPUBLICBASEURL6 },
    { SEPAY_PUBLIC_BASE_URL: D.values.SEPAYPUBLICBASEURL7 },
    { SEPAY_PUBLIC_BASE_URL: D.values.SEPAYPUBLICBASEURL8 },
  ])
    assert.equal(loadSepayConfig({ ...structuralEnv, ...overrides }), D.values.equalScenario8);
  // Presence of explicit IPN input is structural, not proof of its provider relationship.
  assert.ok(
    loadSepayConfig({ ...structuralEnv, SEPAY_IPN_SECRET_KEY: structuralEnv.SEPAY_SECRET_KEY }),
  );
});

test('valid_structural_config_never_enables_any_blocked_sepay_capability', () => {
  assert.ok(loadSepayConfig(structuralEnv));
  const registry = disabledRegistry();
  assert.equal(registry.find(D.values.findScenario), D.values.equalScenario9);
  assert.ok(registry.find(D.values.findScenario2));
  // No adapter exists: every supported or future operation stops at the same registry gate.
  for (const operation of [
    D.values.scenarioValue,
    D.values.scenarioValue2,
    D.values.scenarioValue3,
    D.values.scenarioValue4,
    D.values.scenarioValue5,
    D.values.scenarioValue6,
    D.values.scenarioValue7,
    D.values.scenarioValue8,
  ]) {
    assert.throws(
      () => registry.require(D.values.requireScenario),
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
      provider: D.values.provider,
      event: D.values.event,
      order_status: D.values.orderstatus,
      custom_data: D.values.customdata4,
      providerSettlementId: D.values.providerSettlementId2,
    },
  ];
  for (const input of inputs) {
    assert.equal(VerifiedGatewayEvidence.isVerified(input), D.values.equalScenario10);
    // @ts-expect-error External values cannot satisfy the nominal verified evidence boundary.
    await assert.rejects(settlement.settle(input), /Internally verified gateway evidence required/);
  }
});

test('sepay_checkout_503_never_calls_settlement_or_writes_checkout_or_money', async (context) => {
  const transactions = createCoreTestTransactionManager();
  const userId = D.values.userId;
  const tenancyId = D.values.tenancyId;
  await transactions.run(async ({ repositories }) => {
    await repositories.organization.createOrganization({
      organizationId: D.values.organizationId,
      primaryOwnerUserId: userId,
      name: D.values.name,
    });
    await repositories.property.createProperty({
      propertyId: D.values.propertyId,
      organizationId: D.values.organizationId2,
      name: D.values.name2,
      lifecycleStatus: D.values.lifecycleStatus,
      operationalAddressText: D.values.operationalAddressText,
      operationalLocation: { longitude: D.values.longitude, latitude: D.values.latitude },
      publicLocationProjection: { longitude: D.values.longitude2, latitude: D.values.latitude2 },
    });
    await repositories.property.createRoom({
      roomId: D.values.roomId,
      propertyId: D.values.propertyId2,
      nameOrLabel: D.values.nameOrLabel,
      operationalState: D.values.operationalState,
      recordLifecycle: D.values.recordLifecycle,
    });
    await repositories.tenancy.createTenancy({
      tenancyId,
      roomId: D.values.roomId2,
      status: D.values.status,
      startedAt: D.values.startedAt,
      endedAt: D.values.endedAt,
      endReason: D.values.endReason,
    });
  });
  const settlement = new GatewaySettlementService(transactions);
  const settlementSpy = context.mock.method(settlement, D.values.methodScenario);
  const gateway = new PaymentGatewayService(
    new TenancyService(transactions),
    transactions,
    disabledRegistry(),
    settlement,
  );
  const key = D.values.key;
  await assert.rejects(
    gateway.createCheckout(
      { tenancyId, amount: D.values.amount, provider: D.values.provider2 },
      userId,
      key,
    ),
    (error: unknown) => error instanceof ServiceUnavailableException && error.getStatus() === 503,
  );
  assert.equal(settlementSpy.mock.callCount(), D.values.equalScenario11);
  await transactions.run(async ({ repositories }) => {
    assert.equal(await repositories.finance.findGatewayCheckoutByClientKey(userId, key), undefined);
    assert.deepEqual(await repositories.finance.findPaymentsForTenancy(tenancyId), []);
  });
});

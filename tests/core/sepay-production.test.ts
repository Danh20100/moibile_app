import { sepayRegressionFixture as S } from '../support/sepay-regression-fixtures';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import type fixturesType from '../fixtures/payment/sepay-signed-fields.json';
import { loadFixture } from '../support/fixture-loader';
const fixtures = loadFixture<typeof fixturesType>('payment/sepay-signed-fields');
import { GatewayProviderRegistry } from '../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { MomoGatewayAdapter } from '../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { SepayGatewayAdapter } from '../../src/modules/payment-gateway/providers/sepay-gateway.adapter';
import { HttpMomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { GatewaySettlementService } from '../../src/modules/payment-gateway/services/gateway-settlement.service';
import { SepayHandoffService } from '../../src/modules/payment-gateway/services/sepay-handoff.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { loadSepayConfig } from '../../src/modules/payment-gateway/sepay/sepay-config';
import { loadSepayProductionConfig } from '../../src/modules/payment-gateway/sepay/sepay-production-config';
import {
  SEPAY_PRODUCTION_API_ORIGIN,
  SEPAY_PRODUCTION_CHECKOUT_URL,
  SEPAY_PRODUCTION_PAID_STATUS,
  sepayProductionFields,
  signSepayFields,
} from '../../src/modules/payment-gateway/sepay/sepay-form';
import {
  HttpSepayOrderClient,
  interpretSepayOrder,
  type SepayOrderReader,
  type SepayReadResult,
} from '../../src/modules/payment-gateway/sepay/sepay-order-client';
import type { SepayProductionConfig } from '../../src/modules/payment-gateway/sepay/sepay-production-config';
import {
  sepayHandoffHtml,
  sepayReturnHtml,
} from '../../src/modules/payment-gateway/controllers/sepay-handoff.controller';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const now = new Date(S.values.value);
const userId = S.values.userId;
const tenancyId = S.values.tenancyId;
const config: SepayProductionConfig = {
  environment: S.values.environment,
  merchantId: S.values.merchantId,
  secretKey: fixtures.secret,
  ipnSecretKey: S.values.ipnSecretKey,
  publicBaseUrl: S.values.publicBaseUrl,
  handoffSigningKey: S.values.handoffSigningKey,
  financeDatabase: S.values.financeDatabase,
};

const productionEnv = {
  SEPAY_ENABLED: S.values.SEPAYENABLED,
  SEPAY_ENVIRONMENT: S.values.SEPAYENVIRONMENT,
  NODE_ENV: S.values.NODEENV,
  DATABASE_URL: S.values.DATABASEURL,
  SEPAY_FINANCE_DATABASE: S.values.SEPAYFINANCEDATABASE,
  SEPAY_MERCHANT_ID: S.values.SEPAYMERCHANTID,
  SEPAY_SECRET_KEY: S.values.SEPAYSECRETKEY,
  SEPAY_IPN_SECRET_KEY: S.values.SEPAYIPNSECRETKEY,
  SEPAY_HANDOFF_SIGNING_KEY: S.values.SEPAYHANDOFFSIGNINGKEY,
  SEPAY_PUBLIC_BASE_URL: S.values.SEPAYPUBLICBASEURL,
};

function momoAdapter() {
  return new MomoGatewayAdapter(
    new HttpMomoPaymentClient({
      partnerCode: S.values.partnerCode,
      accessKey: S.values.accessKey,
      secretKey: S.values.secretKey,
      endpoint: S.values.endpoint,
      ipnUrl: S.values.ipnUrl,
      redirectUrl: S.values.redirectUrl,
    }),
  );
}

function paid(
  invoice: string,
  amount = S.values.amount,
): Exclude<SepayReadResult, { kind: 'pending' | 'uncertain' }> {
  return {
    kind: S.values.kind,
    remoteOrderId: S.values.remoteOrderId,
    transactionId: S.values.transactionId,
    invoice,
    amount,
    currency: S.values.currency,
    paymentMethod: S.values.paymentMethod,
  };
}

async function harness(reader: SepayOrderReader) {
  const transactions = createCoreTestTransactionManager();
  await transactions.run(async ({ repositories }) => {
    await repositories.organization.createOrganization({
      organizationId: S.values.organizationId,
      primaryOwnerUserId: userId,
      name: S.values.name,
    });
    await repositories.property.createProperty({
      propertyId: S.values.propertyId,
      organizationId: S.values.organizationId2,
      name: S.values.name2,
      lifecycleStatus: S.values.lifecycleStatus,
      operationalAddressText: S.values.operationalAddressText,
      operationalLocation: { longitude: S.values.longitude, latitude: S.values.latitude },
      publicLocationProjection: { longitude: S.values.longitude2, latitude: S.values.latitude2 },
    });
    await repositories.property.createRoom({
      roomId: S.values.roomId,
      propertyId: S.values.propertyId2,
      nameOrLabel: S.values.nameOrLabel,
      operationalState: S.values.operationalState,
      recordLifecycle: S.values.recordLifecycle,
    });
    await repositories.tenancy.createTenancy({
      tenancyId,
      roomId: S.values.roomId2,
      status: S.values.status,
      startedAt: S.values.startedAt,
      endedAt: S.values.endedAt,
      endReason: S.values.endReason,
    });
  });
  const clock = () => now;
  const adapter = new SepayGatewayAdapter(config, reader, clock);
  const registry = new GatewayProviderRegistry(momoAdapter(), undefined, adapter);
  const settlement = new GatewaySettlementService(transactions, clock);
  const gateway = new PaymentGatewayService(
    new TenancyService(transactions),
    transactions,
    registry,
    settlement,
    undefined,
    clock,
  );
  const handoff = new SepayHandoffService(transactions, adapter, clock);
  return { transactions, adapter, gateway, handoff };
}

test('production hosts and paid status stay distinct from sandbox', () => {
  assert.equal(SEPAY_PRODUCTION_CHECKOUT_URL, S.values.equalExpected);
  assert.equal(SEPAY_PRODUCTION_API_ORIGIN, S.values.equalExpected2);
  assert.equal(SEPAY_PRODUCTION_PAID_STATUS, S.values.equalExpected3);
  assert.equal(
    loadSepayConfig({
      ...productionEnv,
      NODE_ENV: S.values.NODEENV2,
      SEPAY_ENVIRONMENT: S.values.SEPAYENVIRONMENT2,
    }),
    S.values.equalExpected4,
  );
  assert.equal(loadSepayProductionConfig({}), S.values.equalExpected5);
  assert.ok(loadSepayProductionConfig(productionEnv));
  for (const overrides of [
    { SEPAY_ENVIRONMENT: S.values.SEPAYENVIRONMENT3 },
    { SEPAY_ENABLED: S.values.SEPAYENABLED2 },
    { SEPAY_FINANCE_DATABASE: S.values.SEPAYFINANCEDATABASE2 },
    { SEPAY_FINANCE_DATABASE: S.values.SEPAYFINANCEDATABASE3 },
    { SEPAY_FINANCE_DATABASE: S.values.SEPAYFINANCEDATABASE4 },
    { DATABASE_URL: S.values.DATABASEURL2 },
    { DATABASE_URL: S.values.DATABASEURL3 },
    { SEPAY_SECRET_KEY: S.values.SEPAYSECRETKEY2 },
    { SEPAY_PUBLIC_BASE_URL: S.values.SEPAYPUBLICBASEURL2 },
    { SEPAY_PUBLIC_BASE_URL: S.values.SEPAYPUBLICBASEURL3 },
    { SEPAY_HANDOFF_SIGNING_KEY: productionEnv.SEPAY_SECRET_KEY },
  ])
    assert.equal(
      loadSepayProductionConfig({ ...productionEnv, ...overrides }),
      S.values.equalExpected6,
    );
  assert.equal(
    new GatewayProviderRegistry(momoAdapter(), undefined, new SepayGatewayAdapter(null)).find(
      S.values.findScenario,
    ),
    S.values.equalExpected7,
  );
});

test('production form uses the pinned field order and does not treat the return page as payment', () => {
  const fields = sepayProductionFields({
    merchantId: String(fixtures.ordered.fields.merchant),
    amountVnd: S.values.amountVnd,
    invoice: String(fixtures.ordered.fields.order_invoice_number),
    description: String(fixtures.ordered.fields.order_description),
    successUrl: String(fixtures.ordered.fields.success_url),
    errorUrl: String(fixtures.ordered.fields.error_url),
    cancelUrl: String(fixtures.ordered.fields.cancel_url),
  });
  assert.equal(signSepayFields(fields, fixtures.secret), fixtures.ordered.signature);
  const independent = createHmac('sha256', fixtures.secret)
    .update(S.values.updateScenario, 'utf8')
    .digest('base64');
  assert.equal(independent, fixtures.ordered.signature);
  assert.match(sepayReturnHtml('success'), /không phải xác nhận đã thanh toán/);
  assert.match(sepayReturnHtml('success'), /trooi:\/\/payment\/sepay/);
  assert.doesNotMatch(sepayReturnHtml('success'), /PROVIDER_VERIFIED|resultingPaymentId/);
});

test('readback settles only an exact captured bank transfer and ignores return urls', async () => {
  const seen: string[] = [];
  const reader: SepayOrderReader = {
    async readInvoice(invoice) {
      seen.push(invoice);
      return paid(invoice);
    },
  };
  const { transactions, adapter, gateway, handoff } = await harness(reader);
  const key = S.values.key;
  const created = await gateway.createCheckout(
    { tenancyId, amount: S.values.amount, provider: S.values.provider },
    userId,
    key,
  );
  assert.equal(created.provider, S.values.equalExpected8);
  assert.equal(created.status, S.values.equalExpected9);
  assert.match(
    created.payUrl ?? S.values.payUrlInput,
    /^https:\/\/merchant\.example\/api\/v1\/finance\/checkouts\/sepay\/handoff\?token=/,
  );
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.equal(stored?.dispatchLeaseOwner, S.values.equalExpected10);
  assert.equal(stored?.handoffAttempt, S.values.equalExpected11);
  assert.equal(stored?.providerPartnerCode, S.values.equalExpected12);
  assert.equal(
    stored?.requestSnapshot && 'endpoint' in stored.requestSnapshot
      ? stored.requestSnapshot.endpoint
      : S.values.scenarioValue,
    SEPAY_PRODUCTION_CHECKOUT_URL,
  );
  assert.equal(
    JSON.stringify(stored?.requestSnapshot).includes(fixtures.secret),
    S.values.equalExpected13,
  );
  const token =
    new URL(created.payUrl ?? S.values.payUrlInput2).searchParams.get(S.values.getScenario) ??
    S.values.gettokenInput;
  const beforeRead = structuredClone(stored);
  const ready = await handoff.read(token);
  assert.equal(ready.kind, S.values.equalExpected14);
  assert.deepEqual(
    await transactions.run(({ repositories }) =>
      repositories.finance.findGatewayCheckout(created.id),
    ),
    beforeRead,
  );
  const released = await handoff.release(token);
  assert.equal(released.kind, S.values.equalExpected15);
  if (released.kind !== 'form') return;
  assert.equal(released.action, SEPAY_PRODUCTION_CHECKOUT_URL);
  assert.equal(released.fields.signature, signSepayFields(released.fields, fixtures.secret));
  assert.equal(
    JSON.stringify(released.fields).includes(config.secretKey),
    S.values.equalExpected16,
  );
  assert.match(sepayHandoffHtml(released, token), /name="signature"/);
  const again = await handoff.release(token);
  assert.equal(again.kind, S.values.equalExpected17);
  assert.doesNotMatch(sepayHandoffHtml(again, token), /name="signature"/);
  const settled = await gateway.reconcileSepay(created.id, userId);
  assert.equal(settled.status, S.values.equalExpected18);
  const repeated = await gateway.reconcileSepay(created.id, userId);
  assert.equal(repeated.resultingPaymentId, settled.resultingPaymentId);
  assert.equal(seen.length, S.values.equalExpected19);
  const payments = await transactions.run(({ repositories }) =>
    repositories.finance.findPaymentsForTenancy(tenancyId),
  );
  assert.equal(payments.length, S.values.equalExpected20);
  assert.equal(payments[0]?.source, S.values.equalExpected21);
  assert.equal(payments[0]?.verification, S.values.equalExpected22);
  assert.equal(payments[0]?.amount, S.values.equalExpected23);
  const paymentId = payments[0]?.paymentId ?? S.values.paymentIdInput;
  assert.equal(
    (
      await transactions.run(({ repositories }) =>
        repositories.finance.findPaymentAllocations(paymentId),
      )
    ).length,
    S.values.equalExpected24,
  );
  assert.equal(
    (
      await transactions.run(({ repositories }) =>
        repositories.finance.findReceiptsForPayment(paymentId),
      )
    ).length,
    S.values.equalExpected25,
  );
  const bound = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.equal(bound?.providerRemoteOrderId, S.values.equalExpected26);
  assert.equal(bound?.providerTransId, S.values.equalExpected27);
  assert.equal(bound?.providerResultCode, S.values.equalExpected28);
  assert.throws(() => adapter.authenticateNotification(undefined), UnauthorizedException);
  assert.throws(
    () => new SepayGatewayAdapter(null).authenticateNotification(config.ipnSecretKey),
    ServiceUnavailableException,
  );
});

test('amount mismatch and an unavailable adapter do not create a payment', async () => {
  const reader: SepayOrderReader = {
    async readInvoice(invoice) {
      return paid(invoice, S.values.paidScenario);
    },
  };
  const { transactions, gateway } = await harness(reader);
  const created = await gateway.createCheckout(
    { tenancyId, amount: S.values.amount2, provider: S.values.provider2 },
    userId,
    S.values.createCheckoutExpected,
  );
  await assert.rejects(gateway.reconcileSepay(created.id, userId), /not uniquely paid/);
  const row = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.notEqual(row?.status, S.values.notEqualScenario);
  assert.equal(row?.resultingPaymentId, S.values.equalExpected29);
  assert.equal(
    (
      await transactions.run(({ repositories }) =>
        repositories.finance.findPaymentsForTenancy(tenancyId),
      )
    ).length,
    S.values.equalExpected30,
  );
  const closed = new PaymentGatewayService(
    new TenancyService(transactions),
    transactions,
    new GatewayProviderRegistry(momoAdapter()),
    new GatewaySettlementService(transactions),
  );
  await assert.rejects(
    closed.createCheckout(
      { tenancyId, amount: S.values.amount3, provider: S.values.provider3 },
      userId,
      S.values.createCheckoutExpected2,
    ),
    /SEPAY checkout is unavailable/,
  );
  assert.equal(
    (
      await transactions.run(({ repositories }) =>
        repositories.finance.findPaymentsForTenancy(tenancyId),
      )
    ).length,
    S.values.equalExpected31,
  );
});

function ipnContext(url: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: url, url }),
      getResponse: () => ({ statusCode: S.values.statusCode }),
    }),
  } as ExecutionContext;
}

test('sepay ipn acknowledges only a settled bank transfer', async () => {
  let mode: 'pending' | 'uncertain' | 'card' | 'paid' = S.values.mode;
  let reads = 0;
  const reader: SepayOrderReader = {
    async readInvoice(invoice) {
      reads += 1;
      if (mode === S.values.modeInput) return { kind: S.values.kind2 };
      if (mode === S.values.modeInput2) return { kind: S.values.kind3 };
      if (mode === S.values.modeInput3) return { kind: S.values.kind3 };
      return paid(invoice);
    },
  };
  const { transactions, gateway } = await harness(reader);
  const created = await gateway.createCheckout(
    { tenancyId, amount: S.values.amount4, provider: S.values.provider4 },
    userId,
    S.values.createCheckoutExpected3,
  );
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  const invoice = stored?.providerOrderId ?? S.values.providerOrderIdInput;
  const paidBody = {
    notification_type: S.values.notificationtype,
    order: { order_invoice_number: invoice },
    transaction: { payment_method: S.values.paymentmethod },
  };
  await assert.rejects(
    gateway.handleSepayIpn(S.values.handleSepayIpnScenario, paidBody),
    (error: unknown) => error instanceof UnauthorizedException,
  );
  assert.equal(reads, S.values.equalExpected32);
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      notification_type: S.values.notificationtype2,
      order: { order_invoice_number: invoice },
    }),
    (error: unknown) => error instanceof BadRequestException,
  );
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, { notification_type: S.values.notificationtype3 }),
    (error: unknown) => error instanceof BadRequestException,
  );
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      notification_type: S.values.notificationtype4,
      order: { order_invoice_number: S.values.orderinvoicenumber },
    }),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  assert.equal(reads, S.values.equalExpected33);
  mode = S.values.modeInput4;
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, paidBody),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  mode = S.values.modeInput5;
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, paidBody),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  mode = S.values.modeInput6;
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      ...paidBody,
      transaction: { payment_method: S.values.paymentmethod2 },
    }),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  assert.equal(
    (
      await transactions.run(({ repositories }) =>
        repositories.finance.findPaymentsForTenancy(tenancyId),
      )
    ).length,
    S.values.equalExpected34,
  );
  mode = S.values.modeInput7;
  const acknowledged = await gateway.handleSepayIpn(config.ipnSecretKey, paidBody);
  assert.deepEqual(acknowledged, { success: S.values.success });
  const repeated = await gateway.handleSepayIpn(config.ipnSecretKey, paidBody);
  assert.deepEqual(repeated, { success: S.values.success2 });
  const payments = await transactions.run(({ repositories }) =>
    repositories.finance.findPaymentsForTenancy(tenancyId),
  );
  assert.equal(payments.length, S.values.equalExpected35);
  assert.equal(payments[0]?.verification, S.values.equalExpected36);
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      notification_type: S.values.notificationtype5,
      order: { order_invoice_number: invoice },
    }),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(
    (
      await transactions.run(({ repositories }) =>
        repositories.finance.findPaymentsForTenancy(tenancyId),
      )
    ).length,
    S.values.equalExpected37,
  );
  const interceptor = new TransformInterceptor();
  const raw = await lastValueFrom(
    interceptor.intercept(ipnContext('/api/v1/finance/checkouts/sepay/ipn'), {
      handle: () => of(acknowledged),
    } as CallHandler),
  );
  assert.deepEqual(raw, { success: S.values.success3 });
  const wrapped = await lastValueFrom(
    interceptor.intercept(ipnContext('/api/v1/health'), {
      handle: () => of({ status: S.values.status2 }),
    } as CallHandler),
  );
  assert.equal('data' in (wrapped as object), S.values.equalExpected38);
});

test('order detail parser refuses card, ambiguity, and invoice used as order id', () => {
  const invoice = S.values.invoice;
  const list = {
    data: [{ order_id: S.values.orderid, order_invoice_number: invoice }],
    meta: {
      total: S.values.total,
      has_more: S.values.hasmore,
      page_count: S.values.pagecount,
      current_page: S.values.currentpage,
    },
  };
  const detail = {
    data: {
      order_id: S.values.orderid2,
      order_invoice_number: invoice,
      order_status: S.values.orderstatus,
      order_amount: S.values.orderamount,
      order_currency: S.values.ordercurrency,
      transactions: [
        {
          id: S.values.id,
          payment_method: S.values.paymentmethod3,
          transaction_type: S.values.transactiontype,
          transaction_status: S.values.transactionstatus,
          transaction_currency: S.values.transactioncurrency,
          transaction_amount: S.values.transactionamount,
        },
      ],
    },
  };
  assert.equal(
    interpretSepayOrder(list, detail, invoice, S.values.interpretSepayOrderScenario).kind,
    S.values.equalExpected39,
  );
  const card = structuredClone(detail);
  card.data.transactions[0].payment_method = S.values.paymentmethodInput;
  assert.equal(
    interpretSepayOrder(list, card, invoice, S.values.interpretSepayOrderScenario2).kind,
    S.values.equalExpected40,
  );
  assert.equal(
    interpretSepayOrder(
      { ...list, meta: { ...list.meta, total: S.values.total2 } },
      detail,
      invoice,
      S.values.interpretSepayOrderScenario3,
    ).kind,
    S.values.equalExpected41,
  );
  assert.equal(
    interpretSepayOrder(
      {
        data: [],
        meta: {
          total: S.values.total3,
          has_more: S.values.hasmore2,
          page_count: S.values.pagecount2,
          current_page: S.values.currentpage2,
        },
      },
      null,
      invoice,
      S.values.interpretSepayOrderScenario4,
    ).kind,
    S.values.equalExpected42,
  );
  const swapped = structuredClone(list);
  swapped.data[0].order_id = invoice;
  assert.equal(
    interpretSepayOrder(swapped, detail, invoice, S.values.interpretSepayOrderScenario5).kind,
    S.values.equalExpected43,
  );
  const capturedList = {
    data: [
      {
        id: S.values.id2,
        order_id: S.values.orderid3,
        order_invoice_number: invoice,
        order_status: S.values.orderstatus2,
        order_amount: S.values.orderamount2,
        order_currency: S.values.ordercurrency2,
      },
    ],
    meta: {
      total: S.values.total4,
      has_more: S.values.hasmore3,
      page_count: S.values.pagecount3,
      current_page: S.values.currentpage3,
    },
  };
  const fromList = interpretSepayOrder(
    capturedList,
    null,
    invoice,
    S.values.interpretSepayOrderScenario6,
  );
  assert.equal(fromList.kind, S.values.equalExpected44);
  const partial = structuredClone(detail);
  partial.data.transactions[0].transaction_amount = S.values.partialTransactionAmount;
  assert.equal(
    interpretSepayOrder(list, partial, invoice, S.values.interpretSepayOrderScenario).kind,
    S.values.unsettledExpected,
  );
  const awaiting = structuredClone(capturedList);
  awaiting.data[0].order_status = S.values.awaitingOrderStatus;
  assert.equal(
    interpretSepayOrder(awaiting, null, invoice, S.values.interpretSepayOrderScenario6).kind,
    S.values.awaitingExpected,
  );
});

test('http client reads detail by remote order id and does not settle when detail is missing', async () => {
  const invoice = S.values.invoice2;
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.origin}${url.pathname}`);
    if (url.pathname === '/v1/order') {
      return Response.json({
        data: [
          {
            id: S.values.id3,
            order_id: S.values.orderid4,
            order_invoice_number: invoice,
            order_status: S.values.orderstatus3,
            order_amount: S.values.orderamount3,
            order_currency: S.values.ordercurrency3,
          },
        ],
        meta: {
          total: S.values.total5,
          has_more: S.values.hasmore4,
          page_count: S.values.pagecount4,
          current_page: S.values.currentpage4,
        },
      });
    }
    return Response.json({ data: {} }, { status: S.values.status3 });
  };
  const client = new HttpSepayOrderClient(config, fetchImpl);
  const read = await client.readInvoice(invoice);
  assert.equal(read.kind, S.values.equalExpected48);
  assert.deepEqual(urls, [S.values.value2, S.values.value3]);
});

test('reconciliation does not confirm money without a settled transaction', async () => {
  let fail = false;
  const fetchImpl: typeof fetch = async (input) => {
    if (fail) throw new Error(S.values.providerFailureMessage);
    const url = new URL(String(input));
    const invoice = url.searchParams.get('q') ?? S.values.scenarioValue;
    if (url.pathname === '/v1/order') {
      return Response.json({
        data: [
          {
            id: S.values.id3,
            order_id: S.values.orderid4,
            order_invoice_number: invoice,
            order_status: S.values.orderstatus3,
            order_amount: S.values.orderamount3,
            order_currency: S.values.ordercurrency3,
          },
        ],
        meta: {
          total: S.values.total5,
          has_more: S.values.hasmore4,
          page_count: S.values.pagecount4,
          current_page: S.values.currentpage4,
        },
      });
    }
    return Response.json({ data: {} }, { status: S.values.status3 });
  };
  const { transactions, gateway } = await harness(new HttpSepayOrderClient(config, fetchImpl));
  const created = await gateway.createCheckout(
    { tenancyId, amount: S.values.amount, provider: S.values.provider },
    userId,
    S.values.reconciliationCheckoutKey,
  );
  await assert.rejects(
    gateway.reconcileSepay(created.id, userId),
    new RegExp(S.values.reconciliationFailurePattern),
  );
  fail = true;
  await assert.rejects(
    gateway.reconcileSepay(created.id, userId),
    new RegExp(S.values.reconciliationFailurePattern),
  );
  const row = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.notEqual(row?.status, S.values.notEqualScenario);
  assert.equal(
    (
      await transactions.run(({ repositories }) =>
        repositories.finance.findPaymentsForTenancy(tenancyId),
      )
    ).length,
    S.values.paymentCountExpected,
  );
});

test('authenticated SePay IPN fallback settles one Payment only when amount and tenancy match', async () => {
  const reader: SepayOrderReader = {
    async readInvoice() { return { kind: 'uncertain' }; },
    async readVerifiedIpn(invoice, payload) {
      const order = (payload as { order?: { order_invoice_number?: string; order_id?: string; order_amount?: string } }).order;
      const transaction = (payload as { transaction?: { id?: string; transaction_amount?: string } }).transaction;
      if (order?.order_invoice_number !== invoice ||
          order?.order_amount !== S.values.paidScenario ||
          transaction?.transaction_amount !== S.values.paidScenario.split('.')[0]) return { kind: 'uncertain' };
      return {
        kind: 'paid', invoice,
        remoteOrderId: S.values.remoteOrderId,
        transactionId: S.values.transactionId,
        amount: S.values.paidScenario, currency: S.values.currency, paymentMethod: S.values.paymentMethod,
      };
    },
  };
  const { transactions, gateway } = await harness(reader);
  const created = await gateway.createCheckout(
    { tenancyId, amount: S.values.paidScenario.split('.')[0], provider: S.values.provider }, userId,
    S.values.key,
  );
  const row = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.ok(row);
  const notice = {
    timestamp: 1792000000,
    notification_type: 'ORDER_PAID',
    order: {
      order_invoice_number: row.providerOrderId, order_id: S.values.remoteOrderId,
      order_status: 'CAPTURED', order_amount: S.values.paidScenario, order_currency: S.values.currency,
    },
    transaction: {
      id: S.values.transactionId, payment_method: S.values.paymentMethod,
      transaction_type: 'PAYMENT', transaction_status: 'APPROVED',
      transaction_amount: S.values.paidScenario.split('.')[0], transaction_currency: S.values.currency,
    },
  };
  await assert.rejects(
    gateway.handleSepayIpn('invalid-key', notice),
    (error: unknown) => error instanceof UnauthorizedException,
  );
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      ...notice,
      transaction: { ...notice.transaction, transaction_amount: String(Number(S.values.paidScenario.split('.')[0]) + 1) },
    }),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  assert.equal(
    (await transactions.run(({ repositories }) =>
      repositories.finance.findPaymentsForTenancy(tenancyId))).length, 0,
  );
  const first = await gateway.handleSepayIpn(config.ipnSecretKey, notice);
  const replay = await gateway.handleSepayIpn(config.ipnSecretKey, notice);
  assert.deepEqual(first, { success: true });
  assert.deepEqual(replay, { success: true });
  const settled = await transactions.run(async ({ repositories }) => {
    const checkout = await repositories.finance.findGatewayCheckout(created.id);
    const payments = await repositories.finance.findPaymentsForTenancy(tenancyId);
    return { checkout, payments };
  });
  assert.equal(settled.checkout?.status, 'SUCCEEDED');
  assert.equal(settled.checkout?.providerOutcomeStage, 'PAYMENT_IPN');
  assert.equal(settled.payments.length, 1);
  assert.equal(settled.payments[0].paymentId, settled.checkout?.resultingPaymentId);
  assert.equal(settled.payments[0].amount, S.values.paidScenario);
  assert.equal(settled.payments[0].source, 'GATEWAY');
  assert.equal(settled.payments[0].verification, 'PROVIDER_VERIFIED');
});

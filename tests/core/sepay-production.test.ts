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

import fixtures from './fixtures/sepay-signed-fields.json';
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

const now = new Date('2026-10-09T10:00:00.000Z');
const userId = '10000000-0000-4000-8000-000000000001';
const tenancyId = '60000000-0000-4000-8000-000000000001';
const config: SepayProductionConfig = {
  environment: 'production',
  merchantId: 'TASK0_NONSECRET_MERCHANT',
  secretKey: fixtures.secret,
  ipnSecretKey: 'NONSECRET-EXPLICIT-IPN-KEY',
  publicBaseUrl: 'https://merchant.example',
  handoffSigningKey: 'NONSECRET-SEPARATE-HANDOFF-KEY',
  financeDatabase: 'trooi_finance',
};

const productionEnv = {
  SEPAY_ENABLED: 'true',
  SEPAY_ENVIRONMENT: 'production',
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://database.example/trooi_finance',
  SEPAY_FINANCE_DATABASE: 'trooi_finance',
  SEPAY_MERCHANT_ID: 'NONSECRET-MERCHANT',
  SEPAY_SECRET_KEY: 'NONSECRET-FORM-KEY',
  SEPAY_IPN_SECRET_KEY: 'NONSECRET-EXPLICIT-IPN-KEY',
  SEPAY_HANDOFF_SIGNING_KEY: 'NONSECRET-SEPARATE-HANDOFF-KEY',
  SEPAY_PUBLIC_BASE_URL: 'https://merchant.example',
};

function momoAdapter() {
  return new MomoGatewayAdapter(
    new HttpMomoPaymentClient({
      partnerCode: 'TEST',
      accessKey: 'test',
      secretKey: 'test',
      endpoint: 'https://test-payment.momo.vn',
      ipnUrl: 'https://merchant.example/ipn',
      redirectUrl: 'trooi://payment/momo',
    }),
  );
}

function paid(invoice: string, amount = '1000.00'): Exclude<SepayReadResult, { kind: 'pending' | 'uncertain' }> {
  return {
    kind: 'paid',
    remoteOrderId: 'SEPAY-68BA83CE637C1',
    transactionId: '91',
    invoice,
    amount,
    currency: 'VND',
    paymentMethod: 'BANK_TRANSFER',
  };
}

async function harness(reader: SepayOrderReader) {
  const transactions = createCoreTestTransactionManager();
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
  assert.equal(SEPAY_PRODUCTION_CHECKOUT_URL, 'https://pay.sepay.vn/v1/checkout/init');
  assert.equal(SEPAY_PRODUCTION_API_ORIGIN, 'https://pgapi.sepay.vn');
  assert.equal(SEPAY_PRODUCTION_PAID_STATUS, 'CAPTURED');
  assert.equal(loadSepayConfig({ ...productionEnv, NODE_ENV: 'development', SEPAY_ENVIRONMENT: 'sandbox' }), null);
  assert.equal(loadSepayProductionConfig({}), null);
  assert.ok(loadSepayProductionConfig(productionEnv));
  for (const overrides of [
    { SEPAY_ENVIRONMENT: 'sandbox' },
    { SEPAY_ENABLED: 'false' },
    { SEPAY_FINANCE_DATABASE: 'trooi_test' },
    { SEPAY_FINANCE_DATABASE: 'trooi_dev' },
    { SEPAY_FINANCE_DATABASE: 'trooi_sandbox' },
    { DATABASE_URL: 'postgresql://database.example/trooi_dev' },
    { DATABASE_URL: 'postgresql://database.example/trooi_test' },
    { SEPAY_SECRET_KEY: '' },
    { SEPAY_PUBLIC_BASE_URL: 'http://merchant.example' },
    { SEPAY_PUBLIC_BASE_URL: 'https://merchant.example/pay' },
    { SEPAY_HANDOFF_SIGNING_KEY: productionEnv.SEPAY_SECRET_KEY },
  ])
    assert.equal(loadSepayProductionConfig({ ...productionEnv, ...overrides }), null);
  assert.equal(new GatewayProviderRegistry(momoAdapter(), undefined, new SepayGatewayAdapter(null)).find('SEPAY'), null);
});

test('production form uses the pinned field order and does not treat the return page as payment', () => {
  const fields = sepayProductionFields({
    merchantId: String(fixtures.ordered.fields.merchant),
    amountVnd: 1000,
    invoice: String(fixtures.ordered.fields.order_invoice_number),
    description: String(fixtures.ordered.fields.order_description),
    successUrl: String(fixtures.ordered.fields.success_url),
    errorUrl: String(fixtures.ordered.fields.error_url),
    cancelUrl: String(fixtures.ordered.fields.cancel_url),
  });
  assert.equal(signSepayFields(fields, fixtures.secret), fixtures.ordered.signature);
  const independent = createHmac('sha256', fixtures.secret)
    .update(
      'merchant=TASK0_NONSECRET_MERCHANT,operation=PURCHASE,payment_method=BANK_TRANSFER,order_amount=1000,currency=VND,order_invoice_number=TROOI-SEPAY-00000000000040008000000000000001,order_description=Task0 fixture,success_url=https://merchant.example/api/v1/finance/checkouts/sepay/return/success,error_url=https://merchant.example/api/v1/finance/checkouts/sepay/return/error,cancel_url=https://merchant.example/api/v1/finance/checkouts/sepay/return/cancel',
      'utf8',
    )
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
  const key = '90000000-0000-4000-8000-000000000091';
  const created = await gateway.createCheckout(
    { tenancyId, amount: '1000.00', provider: 'SEPAY' },
    userId,
    key,
  );
  assert.equal(created.provider, 'SEPAY');
  assert.equal(created.status, 'CREATED');
  assert.match(created.payUrl ?? '', /^https:\/\/merchant\.example\/api\/v1\/finance\/checkouts\/sepay\/handoff\?token=/);
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.equal(stored?.dispatchLeaseOwner, null);
  assert.equal(stored?.handoffAttempt, 0);
  assert.equal(stored?.providerPartnerCode, 'production:TASK0_NONSECRET_MERCHANT');
  assert.equal(stored?.requestSnapshot && 'endpoint' in stored.requestSnapshot ? stored.requestSnapshot.endpoint : '', SEPAY_PRODUCTION_CHECKOUT_URL);
  assert.equal(JSON.stringify(stored?.requestSnapshot).includes(fixtures.secret), false);
  const token = new URL(created.payUrl ?? '').searchParams.get('token') ?? '';
  const beforeRead = structuredClone(stored);
  const ready = await handoff.read(token);
  assert.equal(ready.kind, 'ready');
  assert.deepEqual(
    await transactions.run(({ repositories }) => repositories.finance.findGatewayCheckout(created.id)),
    beforeRead,
  );
  const released = await handoff.release(token);
  assert.equal(released.kind, 'form');
  if (released.kind !== 'form') return;
  assert.equal(released.action, SEPAY_PRODUCTION_CHECKOUT_URL);
  assert.equal(released.fields.signature, signSepayFields(released.fields, fixtures.secret));
  assert.equal(JSON.stringify(released.fields).includes(config.secretKey), false);
  assert.match(sepayHandoffHtml(released, token), /name="signature"/);
  const again = await handoff.release(token);
  assert.equal(again.kind, 'issued');
  assert.doesNotMatch(sepayHandoffHtml(again, token), /name="signature"/);
  const settled = await gateway.reconcileSepay(created.id, userId);
  assert.equal(settled.status, 'SUCCEEDED');
  const repeated = await gateway.reconcileSepay(created.id, userId);
  assert.equal(repeated.resultingPaymentId, settled.resultingPaymentId);
  assert.equal(seen.length, 1);
  const payments = await transactions.run(({ repositories }) =>
    repositories.finance.findPaymentsForTenancy(tenancyId),
  );
  assert.equal(payments.length, 1);
  assert.equal(payments[0]?.source, 'GATEWAY');
  assert.equal(payments[0]?.verification, 'PROVIDER_VERIFIED');
  assert.equal(payments[0]?.amount, '1000.00');
  const paymentId = payments[0]?.paymentId ?? '';
  assert.equal((await transactions.run(({ repositories }) => repositories.finance.findPaymentAllocations(paymentId))).length, 0);
  assert.equal((await transactions.run(({ repositories }) => repositories.finance.findReceiptsForPayment(paymentId))).length, 0);
  const bound = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.equal(bound?.providerRemoteOrderId, 'SEPAY-68BA83CE637C1');
  assert.equal(bound?.providerTransId, '91');
  assert.equal(bound?.providerResultCode, null);
  assert.throws(() => adapter.authenticateNotification(undefined), UnauthorizedException);
  assert.throws(() => new SepayGatewayAdapter(null).authenticateNotification(config.ipnSecretKey), ServiceUnavailableException);
});

test('amount mismatch and an unavailable adapter do not create a payment', async () => {
  const reader: SepayOrderReader = {
    async readInvoice(invoice) {
      return paid(invoice, '2000.00');
    },
  };
  const { transactions, gateway } = await harness(reader);
  const created = await gateway.createCheckout(
    { tenancyId, amount: '1000', provider: 'SEPAY' },
    userId,
    '90000000-0000-4000-8000-000000000092',
  );
  await assert.rejects(gateway.reconcileSepay(created.id, userId), /not uniquely paid/);
  const row = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.notEqual(row?.status, 'SUCCEEDED');
  assert.equal(row?.resultingPaymentId, null);
  assert.equal((await transactions.run(({ repositories }) => repositories.finance.findPaymentsForTenancy(tenancyId))).length, 0);
  const closed = new PaymentGatewayService(
    new TenancyService(transactions),
    transactions,
    new GatewayProviderRegistry(momoAdapter()),
    new GatewaySettlementService(transactions),
  );
  await assert.rejects(
    closed.createCheckout({ tenancyId, amount: '1000', provider: 'SEPAY' }, userId, '90000000-0000-4000-8000-000000000093'),
    /SEPAY checkout is unavailable/,
  );
  assert.equal((await transactions.run(({ repositories }) => repositories.finance.findPaymentsForTenancy(tenancyId))).length, 0);
});

function ipnContext(url: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: url, url }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as ExecutionContext;
}

test('sepay ipn acknowledges only a settled bank transfer', async () => {
  let mode: 'pending' | 'uncertain' | 'card' | 'paid' = 'paid';
  let reads = 0;
  const reader: SepayOrderReader = {
    async readInvoice(invoice) {
      reads += 1;
      if (mode === 'pending') return { kind: 'pending' };
      if (mode === 'uncertain') return { kind: 'uncertain' };
      if (mode === 'card') return { kind: 'uncertain' };
      return paid(invoice);
    },
  };
  const { transactions, gateway } = await harness(reader);
  const created = await gateway.createCheckout(
    { tenancyId, amount: '1000.00', provider: 'SEPAY' },
    userId,
    '90000000-0000-4000-8000-000000000094',
  );
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  const invoice = stored?.providerOrderId ?? '';
  const paidBody = {
    notification_type: 'ORDER_PAID',
    order: { order_invoice_number: invoice },
    transaction: { payment_method: 'BANK_TRANSFER' },
  };
  await assert.rejects(
    gateway.handleSepayIpn('wrong-secret', paidBody),
    (error: unknown) => error instanceof UnauthorizedException,
  );
  assert.equal(reads, 0);
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      notification_type: 'TRANSACTION_VOID',
      order: { order_invoice_number: invoice },
    }),
    (error: unknown) => error instanceof BadRequestException,
  );
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, { notification_type: 'ORDER_PAID' }),
    (error: unknown) => error instanceof BadRequestException,
  );
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      notification_type: 'ORDER_PAID',
      order: { order_invoice_number: 'TROOI-SEPAY-missing' },
    }),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  assert.equal(reads, 0);
  mode = 'pending';
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, paidBody),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  mode = 'uncertain';
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, paidBody),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  mode = 'card';
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      ...paidBody,
      transaction: { payment_method: 'CARD' },
    }),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  assert.equal(
    (await transactions.run(({ repositories }) => repositories.finance.findPaymentsForTenancy(tenancyId))).length,
    0,
  );
  mode = 'paid';
  const acknowledged = await gateway.handleSepayIpn(config.ipnSecretKey, paidBody);
  assert.deepEqual(acknowledged, { success: true });
  const repeated = await gateway.handleSepayIpn(config.ipnSecretKey, paidBody);
  assert.deepEqual(repeated, { success: true });
  const payments = await transactions.run(({ repositories }) =>
    repositories.finance.findPaymentsForTenancy(tenancyId),
  );
  assert.equal(payments.length, 1);
  assert.equal(payments[0]?.verification, 'PROVIDER_VERIFIED');
  await assert.rejects(
    gateway.handleSepayIpn(config.ipnSecretKey, {
      notification_type: 'TRANSACTION_VOID',
      order: { order_invoice_number: invoice },
    }),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(
    (await transactions.run(({ repositories }) => repositories.finance.findPaymentsForTenancy(tenancyId))).length,
    1,
  );
  const interceptor = new TransformInterceptor();
  const raw = await lastValueFrom(
    interceptor.intercept(ipnContext('/api/v1/finance/checkouts/sepay/ipn'), {
      handle: () => of(acknowledged),
    } as CallHandler),
  );
  assert.deepEqual(raw, { success: true });
  const wrapped = await lastValueFrom(
    interceptor.intercept(ipnContext('/api/v1/health'), {
      handle: () => of({ status: 'ok' }),
    } as CallHandler),
  );
  assert.equal('data' in (wrapped as object), true);
});

test('order detail parser refuses card, ambiguity, and invoice used as order id', () => {
  const invoice = 'TROOI-SEPAY-00000000000040008000000000000001';
  const list = {
    data: [{ order_id: 'SEPAY-68BA83CE637C1', order_invoice_number: invoice }],
    meta: { total: 1, has_more: false, page_count: 1, current_page: 1 },
  };
  const detail = {
    data: {
      order_id: 'SEPAY-68BA83CE637C1',
      order_invoice_number: invoice,
      order_status: 'CAPTURED',
      order_amount: '1000.00',
      order_currency: 'VND',
      transactions: [
        {
          id: '91',
          payment_method: 'BANK_TRANSFER',
          transaction_type: 'PAYMENT',
          transaction_status: 'APPROVED',
          transaction_currency: 'VND',
          transaction_amount: '1000',
        },
      ],
    },
  };
  assert.equal(interpretSepayOrder(list, detail, invoice, 'MERCHANT').kind, 'paid');
  const card = structuredClone(detail);
  card.data.transactions[0].payment_method = 'CARD';
  assert.equal(interpretSepayOrder(list, card, invoice, 'MERCHANT').kind, 'uncertain');
  assert.equal(interpretSepayOrder({ ...list, meta: { ...list.meta, total: 2 } }, detail, invoice, 'MERCHANT').kind, 'uncertain');
  assert.equal(interpretSepayOrder({ data: [], meta: { total: 0, has_more: false, page_count: 0, current_page: 1 } }, null, invoice, 'MERCHANT').kind, 'uncertain');
  const swapped = structuredClone(list);
  swapped.data[0].order_id = invoice;
  assert.equal(interpretSepayOrder(swapped, detail, invoice, 'MERCHANT').kind, 'uncertain');
  const capturedList = {
    data: [
      {
        id: '90000000-0000-4000-8000-000000000091',
        order_id: 'PAY475TESTORDER0001',
        order_invoice_number: invoice,
        order_status: 'CAPTURED',
        order_amount: '1000.00',
        order_currency: 'VND',
      },
    ],
    meta: { total: 1, has_more: false, page_count: 1, current_page: 1 },
  };
  const fromList = interpretSepayOrder(capturedList, null, invoice, 'MERCHANT');
  assert.equal(fromList.kind, 'uncertain');
  const partial = structuredClone(detail);
  partial.data.transactions[0].transaction_amount = '400';
  assert.equal(interpretSepayOrder(list, partial, invoice, 'MERCHANT').kind, 'uncertain');
  const awaiting = structuredClone(capturedList);
  awaiting.data[0].order_status = 'AUTHENTICATION_NOT_NEEDED';
  assert.equal(interpretSepayOrder(awaiting, null, invoice, 'MERCHANT').kind, 'pending');
});

test('http client reads detail by remote order id and does not settle when detail is missing', async () => {
  const invoice = 'TROOI-SEPAY-00000000000040008000000000000001';
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.origin}${url.pathname}`);
    if (url.pathname === '/v1/order') {
      return Response.json({
        data: [
          {
            id: '90000000-0000-4000-8000-000000000091',
            order_id: 'PAY475TESTORDER0001',
            order_invoice_number: invoice,
            order_status: 'CAPTURED',
            order_amount: '1000.00',
            order_currency: 'VND',
          },
        ],
        meta: { total: 1, has_more: false, page_count: 1, current_page: 1 },
      });
    }
    return Response.json({ data: {} }, { status: 404 });
  };
  const client = new HttpSepayOrderClient(config, fetchImpl);
  const read = await client.readInvoice(invoice);
  assert.equal(read.kind, 'uncertain');
  assert.deepEqual(urls, [
    'https://pgapi.sepay.vn/v1/order',
    'https://pgapi.sepay.vn/v1/order/detail/PAY475TESTORDER0001',
  ]);
});

test('reconciliation does not confirm money without a settled transaction', async () => {
  let fail = false;
  const fetchImpl: typeof fetch = async (input) => {
    if (fail) throw new Error('sepay down');
    const url = new URL(String(input));
    const invoice = url.searchParams.get('q') ?? '';
    if (url.pathname === '/v1/order') {
      return Response.json({
        data: [
          {
            id: '90000000-0000-4000-8000-000000000091',
            order_id: 'PAY475TESTORDER0001',
            order_invoice_number: invoice,
            order_status: 'CAPTURED',
            order_amount: '1000.00',
            order_currency: 'VND',
          },
        ],
        meta: { total: 1, has_more: false, page_count: 1, current_page: 1 },
      });
    }
    return Response.json({ data: {} }, { status: 404 });
  };
  const { transactions, gateway } = await harness(new HttpSepayOrderClient(config, fetchImpl));
  const created = await gateway.createCheckout(
    { tenancyId, amount: '1000.00', provider: 'SEPAY' },
    userId,
    '90000000-0000-4000-8000-000000000095',
  );
  await assert.rejects(gateway.reconcileSepay(created.id, userId), /not uniquely paid/);
  fail = true;
  await assert.rejects(gateway.reconcileSepay(created.id, userId), /not uniquely paid/);
  const row = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(created.id),
  );
  assert.notEqual(row?.status, 'SUCCEEDED');
  assert.equal(
    (await transactions.run(({ repositories }) => repositories.finance.findPaymentsForTenancy(tenancyId))).length,
    0,
  );
});

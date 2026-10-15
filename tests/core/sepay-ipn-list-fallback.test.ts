import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpSepayOrderClient } from '../../src/modules/payment-gateway/sepay/sepay-order-client';
import { readSepayAuthenticatedBankTransferIpn } from '../../src/modules/payment-gateway/sepay/sepay-ipn';
import type { SepayProductionConfig } from '../../src/modules/payment-gateway/sepay/sepay-production-config';

const config: SepayProductionConfig = {
  environment: 'production',
  merchantId: 'merchant-test',
  secretKey: 'unit-test-only',
  ipnSecretKey: 'ipn-unit-test-only',
  handoffSigningKey: 'handoff-unit-test-only',
  publicBaseUrl: 'https://merchant.example',
  financeDatabase: 'isolated-unit-test',
};
const invoice = 'TROOI-SEPAY-3de48ef9e4f044e58f321c1817991287';
const remoteOrderId = 'SEPAY-TEST-123';
const transactionId = 'd0000000-0000-4000-8000-000000000001';
const baseList = {
  meta: { total: 1, page_count: 1, current_page: 1, has_more: false },
  data: [{
    order_invoice_number: invoice, order_id: remoteOrderId,
    order_status: 'CAPTURED', order_amount: '2000.00', order_currency: 'VND',
  }],
};
const goodIpn = {
  timestamp: 1792000000,
  notification_type: 'ORDER_PAID',
  order: {
    order_id: remoteOrderId, order_invoice_number: invoice,
    order_status: 'CAPTURED', order_amount: '2000.00', order_currency: 'VND',
  },
  transaction: {
    id: transactionId, payment_method: 'BANK_TRANSFER',
    transaction_type: 'PAYMENT', transaction_status: 'APPROVED',
    transaction_amount: '2000', transaction_currency: 'VND',
  },
};

function reader(listBody: unknown, detailStatus = 404) {
  const requests: string[] = [];
  const fakeFetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    if (url.pathname === '/v1/order')
      return new Response(JSON.stringify(listBody), { status: 200 });
    if (url.pathname.startsWith('/v1/order/detail/'))
      return new Response(detailStatus === 200 ? '{}' : 'Not found', { status: detailStatus });
    return new Response('Not found', { status: 404 });
  }) as typeof fetch;
  return { client: new HttpSepayOrderClient(config, fakeFetch), requests };
}

test('detail HTTP 404 alone remains uncertain; signed IPN and unique REST CAPTURED enable fallback', async () => {
  const { client, requests } = reader(baseList);
  assert.deepEqual(await client.readInvoice(invoice), { kind: 'uncertain' });
  const result = await client.readVerifiedIpn(invoice, goodIpn);
  assert.deepEqual(result, {
    kind: 'paid', remoteOrderId, transactionId, invoice,
    amount: '2000.00', currency: 'VND', paymentMethod: 'BANK_TRANSFER',
  });
  assert.ok(requests.some(value => value.includes('/v1/order/detail/')));
});

test('reject malformed, mismatched and non-bank IPN transfers', async () => {
  const { client } = reader(baseList);
  const badCases = [
    { ...goodIpn, order: { ...goodIpn.order, order_invoice_number: 'OTHER' } },
    { ...goodIpn, order: { ...goodIpn.order, order_amount: '2001.00' } },
    { ...goodIpn, order: { ...goodIpn.order, order_id: 'SEPAY-OTHER' } },
    { ...goodIpn, transaction: { ...goodIpn.transaction, transaction_amount: '1999' } },
    { ...goodIpn, transaction: { ...goodIpn.transaction, payment_method: 'CARD' } },
    { ...goodIpn, transaction: { ...goodIpn.transaction, transaction_status: 'PENDING' } },
    { ...goodIpn, transaction: { ...goodIpn.transaction, transaction_type: 'REFUND' } },
    { ...goodIpn, timestamp: 'not-a-time' },
  ];
  for (const bad of badCases) {
    if (bad.order.order_invoice_number === invoice && bad.order.order_id === remoteOrderId)
      assert.equal(readSepayAuthenticatedBankTransferIpn(bad), null);
    assert.deepEqual(await client.readVerifiedIpn(invoice, bad), { kind: 'uncertain' });
  }
});

test('reject ambiguous, pending, mismatched, or unusable provider REST lists', async () => {
  const badLists = [
    { ...baseList, meta: { ...baseList.meta, total: 2 } },
    { ...baseList, data: [{ ...baseList.data[0], order_status: 'AUTHENTICATION_NOT_NEEDED' }] },
    { ...baseList, data: [{ ...baseList.data[0], order_amount: '2001.00' }] },
    { ...baseList, data: [{ ...baseList.data[0], order_currency: 'USD' }] },
    { ...baseList, data: [{ ...baseList.data[0], order_id: 'SEPAY-OTHER' }] },
    { ...baseList, data: [{ ...baseList.data[0], order_invoice_number: 'OTHER' }] },
    { ...baseList, data: [] },
  ];
  for (const listed of badLists) {
    assert.deepEqual(await reader(listed).client.readVerifiedIpn(invoice, goodIpn), { kind: 'uncertain' });
  }
});

test('do not use fallback when detail responds with anything other than HTTP 404', async () => {
  for (const status of [200, 401, 403, 429, 500]) {
    const { client } = reader(baseList, status);
    assert.deepEqual(await client.readVerifiedIpn(invoice, goodIpn), { kind: 'uncertain' });
  }
});

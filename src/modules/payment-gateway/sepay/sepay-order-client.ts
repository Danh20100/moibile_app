import { SEPAY_PRODUCTION_API_ORIGIN, SEPAY_PRODUCTION_PAID_STATUS } from './sepay-form';
import type { SepayProductionConfig } from './sepay-production-config';
import { readSepayAuthenticatedBankTransferIpn } from './sepay-ipn';

export type SepayReadResult =
  | {
      kind: 'paid';
      remoteOrderId: string;
      transactionId: string;
      invoice: string;
      amount: string;
      currency: 'VND';
      paymentMethod: 'BANK_TRANSFER';
    }
  | { kind: 'pending' }
  | { kind: 'uncertain' };

export interface SepayOrderReader {
  readInvoice(invoice: string): Promise<SepayReadResult>;
  readVerifiedIpn?(invoice: string, payload: unknown): Promise<SepayReadResult>;
}

export const SEPAY_ORDER_READER = Symbol('SEPAY_ORDER_READER');

const uncertain: SepayReadResult = { kind: 'uncertain' };
const pending: SepayReadResult = { kind: 'pending' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wholeVnd(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  const match = /^(\d+)(?:\.0+)?$/.exec(text);
  if (!match) return null;
  const whole = match[1].replace(/^0+(?=\d)/, '');
  if (!whole || whole.length > 18) return null;
  return `${whole}.00`;
}

function transactionId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    value.trim() === value &&
    !/\s/.test(value)
  )
    return value;
  return null;
}

function remoteOrderId(value: unknown, invoice: string): string | null {
  if (
    typeof value !== 'string' ||
    value === invoice ||
    value.startsWith('TROOI-SEPAY-') ||
    value.length === 0 ||
    value.length > 255 ||
    value.trim() !== value ||
    /\s/.test(value) ||
    !/^[A-Za-z0-9-]+$/.test(value)
  )
    return null;
  return value;
}

function listedWithoutDetail(listed: Record<string, unknown>): SepayReadResult {
  if (listed.order_status === 'AUTHENTICATION_NOT_NEEDED' || listed.order_status === 'CANCELLED')
    return pending;
  return uncertain;
}

export function interpretSepayOrder(
  listBody: unknown,
  detailBody: unknown,
  invoice: string,
  merchantId: string,
): SepayReadResult {
  if (!isRecord(listBody) || !isRecord(listBody.meta) || !Array.isArray(listBody.data))
    return uncertain;
  const meta = listBody.meta;
  if (
    meta.total !== 1 ||
    meta.has_more !== false ||
    meta.page_count !== 1 ||
    meta.current_page !== 1 ||
    listBody.data.length !== 1
  )
    return uncertain;
  const listed = listBody.data[0];
  if (!isRecord(listed) || listed.order_invoice_number !== invoice) return uncertain;
  const orderId = remoteOrderId(listed.order_id, invoice);
  if (!orderId) return uncertain;
  if (!isRecord(detailBody) || !isRecord(detailBody.data)) return listedWithoutDetail(listed);
  const data = detailBody.data;
  if (
    data.order_id !== orderId ||
    data.order_invoice_number !== invoice ||
    data.order_currency !== 'VND'
  )
    return uncertain;
  for (const key of ['merchant', 'merchant_id', 'merchantId']) {
    if (key in data && data[key] != null && data[key] !== merchantId) return uncertain;
  }
  const amount = wholeVnd(data.order_amount);
  if (!amount) return uncertain;
  if (data.order_status === 'AUTHENTICATION_NOT_NEEDED' || data.order_status === 'CANCELLED')
    return pending;
  if (data.order_status !== SEPAY_PRODUCTION_PAID_STATUS) return uncertain;
  if (
    !Array.isArray(data.transactions) ||
    data.transactions.length !== 1 ||
    !isRecord(data.transactions[0])
  )
    return uncertain;
  const payment = data.transactions[0];
  const id = transactionId(payment.id);
  if (
    !id ||
    payment.payment_method !== 'BANK_TRANSFER' ||
    payment.transaction_type !== 'PAYMENT' ||
    payment.transaction_status !== 'APPROVED' ||
    payment.transaction_currency !== 'VND' ||
    wholeVnd(payment.transaction_amount) !== amount
  )
    return uncertain;
  return {
    kind: 'paid',
    remoteOrderId: orderId,
    transactionId: id,
    invoice,
    amount,
    currency: 'VND',
    paymentMethod: 'BANK_TRANSFER',
  };
}

export class HttpSepayOrderClient implements SepayOrderReader {
  constructor(
    private readonly config: SepayProductionConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async readInvoice(invoice: string): Promise<SepayReadResult> {
    const listUrl = new URL('/v1/order', SEPAY_PRODUCTION_API_ORIGIN);
    listUrl.searchParams.set('q', invoice);
    listUrl.searchParams.set('per_page', '1');
    listUrl.searchParams.set('page', '1');
    const listed = await this.get(listUrl);
    if (!listed) return uncertain;
    const listedOrder = isRecord(listed) && Array.isArray(listed.data) ? listed.data[0] : null;
    const orderId =
      isRecord(listedOrder) && listedOrder.order_invoice_number === invoice
        ? remoteOrderId(listedOrder.order_id, invoice)
        : null;
    if (!orderId) return interpretSepayOrder(listed, null, invoice, this.config.merchantId);
    const detailUrl = new URL(
      `/v1/order/detail/${encodeURIComponent(orderId)}`,
      SEPAY_PRODUCTION_API_ORIGIN,
    );
    const detail = await this.get(detailUrl);
    return interpretSepayOrder(listed, detail, invoice, this.config.merchantId);
  }

  /**
   * Strict fallback for provider detail HTTP 404. Only called after the
   * merchant's X-Secret-Key has authenticated the IPN. A unique CAPTURED REST
   * list result must agree with every identity/amount/transaction field.
   * Normal REST settlement remains the preferred path.
   */
  async readVerifiedIpn(invoice: string, payload: unknown): Promise<SepayReadResult> {
    const proof = readSepayAuthenticatedBankTransferIpn(payload);
    if (!proof || proof.invoice !== invoice) return uncertain;

    const listUrl = new URL('/v1/order', SEPAY_PRODUCTION_API_ORIGIN);
    listUrl.searchParams.set('q', invoice);
    listUrl.searchParams.set('per_page', '1');
    listUrl.searchParams.set('page', '1');
    const listed = await this.get(listUrl);
    if (!isRecord(listed) || !isRecord(listed.meta) || !Array.isArray(listed.data) ||
        listed.meta.total !== 1 || listed.meta.has_more !== false ||
        listed.meta.page_count !== 1 || listed.meta.current_page !== 1 ||
        listed.data.length !== 1) return uncertain;
    const order = listed.data[0];
    if (!isRecord(order) ||
        order.order_invoice_number !== invoice ||
        order.order_status !== SEPAY_PRODUCTION_PAID_STATUS ||
        order.order_currency !== 'VND' ||
        remoteOrderId(order.order_id, invoice) !== proof.remoteOrderId ||
        wholeVnd(order.order_amount) !== proof.amount) return uncertain;
    for (const key of ['merchant', 'merchant_id', 'merchantId']) {
      if (key in order && order[key] != null && order[key] !== this.config.merchantId)
        return uncertain;
    }

    const detailUrl = new URL(
      `/v1/order/detail/${encodeURIComponent(proof.remoteOrderId)}`,
      SEPAY_PRODUCTION_API_ORIGIN,
    );
    const detail = await this.getWithStatus(detailUrl);
    // Fail closed for bad auth, timeouts, conflicts, or a 200 detail with bad data.
    if (detail.status !== 404) return uncertain;
    return {
      kind: 'paid', remoteOrderId: proof.remoteOrderId,
      transactionId: proof.transactionId, invoice,
      amount: proof.amount, currency: 'VND', paymentMethod: 'BANK_TRANSFER',
    };
  }

  private async get(url: URL): Promise<unknown | null> {
    const result = await this.getWithStatus(url);
    return result.status === 200 ? result.body : null;
  }

  private async getWithStatus(url: URL): Promise<{ status: number; body: unknown | null }> {
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: {
          accept: 'application/json',
          authorization: `Basic ${Buffer.from(`${this.config.merchantId}:${this.config.secretKey}`).toString('base64')}`,
        },
      });
      if (response.status !== 200) return { status: response.status, body: null };
      const body = (await response.json()) as unknown;
      return { status: 200, body };
    } catch {
      return { status: -1, body: null };
    }
  }
}

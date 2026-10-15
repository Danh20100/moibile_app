import { createHash, timingSafeEqual } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';

export function sepaySecretsMatch(provided: string, expected: string): boolean {
  const left = createHash('sha256').update(provided, 'utf8').digest();
  const right = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(left, right);
}

export interface SepayAuthenticatedBankTransferIpn {
  invoice: string;
  remoteOrderId: string;
  transactionId: string;
  amount: string;
}

/**
 * Parse a SePay IPN AFTER the caller has authenticated X-Secret-Key.
 * A callback alone is never settlement evidence: the order must independently
 * match exactly one CAPTURED order via authenticated SePay REST.
 */
export function readSepayAuthenticatedBankTransferIpn(
  payload: unknown,
): SepayAuthenticatedBankTransferIpn | null {
  const invoice = readSepayIpnInvoice(payload);
  const body = payload as Record<string, unknown>;
  const order = body.order as Record<string, unknown>;
  const transaction = body.transaction;
  if (typeof transaction !== 'object' || transaction === null || Array.isArray(transaction))
    return null;
  const t = transaction as Record<string, unknown>;
  const remoteOrderId = order.order_id;
  const transactionId = t.id;
  if (
    !Number.isSafeInteger(body.timestamp) ||
    Number(body.timestamp) <= 0 ||
    typeof remoteOrderId !== 'string' ||
    !/^[A-Za-z0-9-]{1,255}$/.test(remoteOrderId) ||
    typeof transactionId !== 'string' ||
    !/^[A-Za-z0-9-]{1,255}$/.test(transactionId) ||
    order.order_status !== 'CAPTURED' ||
    order.order_currency !== 'VND' ||
    t.payment_method !== 'BANK_TRANSFER' ||
    t.transaction_type !== 'PAYMENT' ||
    t.transaction_status !== 'APPROVED' ||
    t.transaction_currency !== 'VND'
  ) return null;
  const amount = normalizeVnd(order.order_amount);
  const transactionAmount = normalizeVnd(t.transaction_amount);
  if (!amount || amount !== transactionAmount) return null;
  return { invoice, remoteOrderId, transactionId, amount };
}

function normalizeVnd(input: unknown): string | null {
  if (typeof input !== 'number' && typeof input !== 'string') return null;
  if (typeof input === 'number' && !Number.isSafeInteger(input)) return null;
  const value = String(input);
  if (!/^[1-9]\d{0,15}(?:\.0+)?$/.test(value)) return null;
  return value.split('.')[0] + '.00';
}

export function readSepayIpnInvoice(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new BadRequestException('Invalid SePay IPN');
  }
  const body = payload as Record<string, unknown>;
  if (body.notification_type !== 'ORDER_PAID') {
    throw new BadRequestException('Invalid SePay IPN');
  }
  const order = body.order;
  if (typeof order !== 'object' || order === null || Array.isArray(order)) {
    throw new BadRequestException('Invalid SePay IPN');
  }
  const invoice = (order as Record<string, unknown>).order_invoice_number;
  if (typeof invoice !== 'string' || invoice.trim() === '' || invoice.length > 255) {
    throw new BadRequestException('Invalid SePay IPN');
  }
  return invoice;
}

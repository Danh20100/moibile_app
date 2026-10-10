import { createHash, timingSafeEqual } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';

export function sepaySecretsMatch(provided: string, expected: string): boolean {
  const left = createHash('sha256').update(provided, 'utf8').digest();
  const right = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(left, right);
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

import { createHmac, timingSafeEqual } from 'node:crypto';

import { ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export const SEPAY_HANDOFF_TTL_MS = 30 * 60 * 1000;

export function signSepayHandoff(checkoutId: string, expiresAtMs: number, key: string): string {
  const payload = `${checkoutId}.${expiresAtMs}`;
  const mac = createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function verifySepayHandoff(token: string, key: string, now: Date): { checkoutId: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new ForbiddenException('SePay handoff is unavailable');
  const [checkoutId, expText, mac] = parts;
  if (!checkoutId || !expText || !mac || !isUUID(checkoutId))
    throw new ForbiddenException('SePay handoff is unavailable');
  if (!/^\d+$/.test(expText)) throw new ForbiddenException('SePay handoff is unavailable');
  const expiresAtMs = Number(expText);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= now.getTime())
    throw new ForbiddenException('SePay handoff is unavailable');
  const expected = createHmac('sha256', key).update(`${checkoutId}.${expText}`).digest('base64url');
  const actual = Buffer.from(mac);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted))
    throw new ForbiddenException('SePay handoff is unavailable');
  return { checkoutId };
}

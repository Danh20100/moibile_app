import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';

import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import type { DemoConfig } from './demo-config';

export interface DemoCapability {
  readonly version: 1;
  readonly provider: 'DEMO';
  readonly purpose: 'demo-confirm';
  readonly checkoutId: string;
  readonly exp: number;
  readonly intentDigest: string;
}

export function demoIntentDigest(record: GatewayCheckoutRecord): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        record.checkoutId,
        record.tenancyId,
        record.createdByUserId,
        record.amount,
        record.referenceCode,
        record.provider,
        record.providerPartnerCode,
        record.providerOrderId,
        record.providerRequestId,
        record.idempotencyKey,
        record.fingerprint,
        record.createdAt,
        record.requestSnapshot,
        record.providerRemoteOrderId,
      ]),
    )
    .digest('hex');
}

export function signDemoCapability(
  record: GatewayCheckoutRecord,
  config: DemoConfig,
  now: Date,
): string {
  const payload: DemoCapability = {
    version: 1,
    provider: 'DEMO',
    purpose: 'demo-confirm',
    checkoutId: record.checkoutId,
    exp: Math.floor(now.getTime() / 1000) + 900,
    intentDigest: demoIntentDigest(record),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${createHmac('sha256', config.signingKey).update(encoded).digest('base64url')}`;
}

export function verifyDemoCapability(token: string, config: DemoConfig, now: Date): DemoCapability {
  const invalid = () => new ForbiddenException('Invalid demo capability');
  if (
    typeof token !== 'string' ||
    token.length > 4096 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  )
    throw invalid();
  const [encoded, signature] = token.split('.');
  const mac = Buffer.from(signature, 'base64url');
  const expected = createHmac('sha256', config.signingKey).update(encoded).digest();
  if (
    mac.toString('base64url') !== signature ||
    mac.length !== expected.length ||
    !timingSafeEqual(mac, expected)
  )
    throw invalid();
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== 1 ||
    !('provider' in value) ||
    value.provider !== 'DEMO' ||
    !('purpose' in value) ||
    value.purpose !== 'demo-confirm' ||
    !('checkoutId' in value) ||
    typeof value.checkoutId !== 'string' ||
    !isUUID(value.checkoutId) ||
    value.checkoutId !== value.checkoutId.toLowerCase() ||
    !('exp' in value) ||
    typeof value.exp !== 'number' ||
    !Number.isSafeInteger(value.exp) ||
    !Number.isFinite(now.getTime()) ||
    now.getTime() >= value.exp * 1000 ||
    !('intentDigest' in value) ||
    typeof value.intentDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.intentDigest)
  )
    throw invalid();
  const payload: DemoCapability = {
    version: 1,
    provider: 'DEMO',
    purpose: 'demo-confirm',
    checkoutId: value.checkoutId,
    exp: value.exp,
    intentDigest: value.intentDigest,
  };
  // Exact encoded round-trip also rejects duplicate/extra fields and alternate JSON/base64 forms.
  if (Buffer.from(JSON.stringify(payload)).toString('base64url') !== encoded) throw invalid();
  return Object.freeze(payload);
}

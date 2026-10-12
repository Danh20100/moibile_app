import { BadRequestException } from '@nestjs/common';

import {
  isNumeric18Scale2NonNegative,
  type DecimalString,
} from '../../../common/domain/decimal-string';
import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import type {
  GatewayProvider,
  GatewaySnapshotBinding,
} from '../../../persistence/ports/gateway-checkout.types';
import type { CreateGatewayCheckoutInput } from '../contracts';

export const GATEWAY_CLOCK = Symbol('GATEWAY_CLOCK');

export function gatewayAmountVnd(amount: DecimalString): number {
  if (!isNumeric18Scale2NonNegative(amount)) {
    throw new BadRequestException(
      'Amount must be a non-negative decimal with at most two decimals',
    );
  }
  const [whole, fraction = ''] = amount.split('.');
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (value < 100000n || value > 5000000000n) {
    throw new BadRequestException('MoMo amount must be between 1000 and 50000000 VND');
  }
  if (value % 100n !== 0n) throw new BadRequestException('MoMo amount must be a whole VND value');
  return Number(value / 100n);
}

export type PreparedGatewayIntent = GatewaySnapshotBinding & {
  merchantScope: string;
  invoice: string;
  requestId: string;
};

export interface PreparedHandoff {
  ready: boolean;
  payUrl: string | null;
  outcome: string | null;
  resultCode: number | null;
  replayBlocker: string | null;
}

interface GatewayEvidenceFields {
  provider: GatewayProvider;
  checkoutId: string;
  tenancyId: string;
  createdByUserId: string;
  idempotencyKey: string | null;
  fingerprint: string | null;
  createdAt: string;
  merchantScope: string;
  invoice: string;
  requestId: string;
  referenceCode: string;
  snapshot: string;
  remoteOrderId: string | null;
  amount: DecimalString;
  currency: 'VND';
  outcome: 'PAYMENT_SUCCEEDED' | 'FINAL_FAILURE' | 'PENDING' | 'RETRYABLE_NON_FINAL' | 'RECONCILE';
  providerSettlementId: string;
  stage: 'PAYMENT_IPN' | 'RECONCILIATION' | 'DEMO_CONFIRMATION';
  resultCode: number | null;
  observation: string;
  replayBlocker: string | null;
}

// Only internal provider verifiers subclass this nominal evidence; HTTP DTOs cannot supply it.
export abstract class VerifiedGatewayEvidence {
  readonly #verified = true;
  readonly data: Readonly<GatewayEvidenceFields>;

  protected constructor(data: GatewayEvidenceFields) {
    this.data = Object.freeze({ ...data });
    Object.freeze(this);
  }

  static isVerified(value: unknown): value is VerifiedGatewayEvidence {
    return typeof value === 'object' && value !== null && #verified in value;
  }
}

export interface GatewayProviderAdapter {
  readonly provider: GatewayProvider;
  prepareIntent(input: CreateGatewayCheckoutInput, checkoutId: string): PreparedGatewayIntent;
  prepareHandoff(record: GatewayCheckoutRecord): Promise<PreparedHandoff>;
  replayReason(record: GatewayCheckoutRecord, now: Date): string | undefined;
  authenticateNotification(input: unknown): void;
  verifyNotification(
    input: unknown,
    record: GatewayCheckoutRecord,
  ): Promise<VerifiedGatewayEvidence>;
}

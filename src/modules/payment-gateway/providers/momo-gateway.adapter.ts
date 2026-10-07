import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import type { CreateGatewayCheckoutInput } from '../contracts';
import {
  MOMO_PAYMENT_CLIENT,
  MomoVerificationError,
  type MomoPaymentClient,
} from '../momo/momo-client';
import { classifyMomoResult } from '../momo/momo-result';
import {
  gatewayAmountVnd,
  VerifiedGatewayEvidence,
  type GatewayProviderAdapter,
  type PreparedHandoff,
  type PreparedGatewayIntent,
} from './gateway-provider';

class MomoVerifiedEvidence extends VerifiedGatewayEvidence {
  constructor(data: VerifiedGatewayEvidence['data']) {
    super(data);
  }
}

@Injectable()
export class MomoGatewayAdapter implements GatewayProviderAdapter {
  readonly provider = 'MOMO';

  constructor(@Inject(MOMO_PAYMENT_CLIENT) private readonly momo: MomoPaymentClient) {}

  prepareIntent(_input: CreateGatewayCheckoutInput, checkoutId: string): PreparedGatewayIntent {
    const snapshot = this.momo.snapshot(checkoutId);
    return {
      provider: 'MOMO',
      requestSnapshot: snapshot,
      merchantScope: snapshot.partnerCode,
      invoice: checkoutId.replace(/-/g, ''),
      requestId: randomUUID().replace(/-/g, ''),
    };
  }

  async prepareHandoff(record: GatewayCheckoutRecord): Promise<PreparedHandoff> {
    let outcome: string | null = null;
    let resultCode: number | null = null;
    let payUrl: string | null = null;
    let replayBlocker: string | null = null;
    if (record.provider !== 'MOMO' || !record.requestSnapshot)
      throw new ConflictException('LEGACY_RECONCILIATION_REQUIRED');
    try {
      const created = await this.momo.createCaptureWallet({
        orderId: record.providerOrderId,
        requestId: record.providerRequestId,
        amountVnd: gatewayAmountVnd(record.amount),
        orderInfo: record.referenceCode,
        checkoutId: record.checkoutId,
        snapshot: record.requestSnapshot,
      });
      resultCode = created.resultCode;
      outcome = classifyMomoResult('CREATE', resultCode, record.requestSnapshot.autoCapture);
      payUrl = outcome === 'CREATE_ACCEPTED' ? created.payUrl : null;
      if (outcome === 'PENDING') replayBlocker = 'PROVIDER_PENDING';
      if (outcome === 'RECONCILE') replayBlocker = 'RECONCILIATION_REQUIRED';
      if (outcome === 'RETRYABLE_NON_FINAL') replayBlocker = 'PROVIDER_CONFIGURATION_REQUIRED';
    } catch (error) {
      if (error instanceof MomoVerificationError) replayBlocker = 'RESPONSE_VERIFICATION_REQUIRED';
      else if (error instanceof ServiceUnavailableException)
        replayBlocker = 'PROVIDER_CONFIGURATION_REQUIRED';
    }
    return { ready: outcome === 'CREATE_ACCEPTED', outcome, resultCode, payUrl, replayBlocker };
  }

  replayReason(record: GatewayCheckoutRecord, now: Date): string | undefined {
    if (record.provider !== 'MOMO') return 'PROVIDER_UNAVAILABLE';
    if (record.replayBlocker) return record.replayBlocker;
    if (!record.requestSnapshot) return 'LEGACY_RECONCILIATION_REQUIRED';
    if (!['INITIATED', 'UNKNOWN'].includes(record.status)) return 'CHECKOUT_NOT_REPLAYABLE';
    if (
      record.firstDispatchAt &&
      now.getTime() >= new Date(record.firstDispatchAt).getTime() + 31 * 86400000
    )
      return 'IDEMPOTENCY_WINDOW_ELAPSED';
    if (record.dispatchLeaseUntil && new Date(record.dispatchLeaseUntil).getTime() > now.getTime())
      return 'DISPATCH_IN_PROGRESS';
    return undefined;
  }

  authenticateNotification(input: unknown): void {
    if (!this.momo.verifyIpn(input)) throw new UnauthorizedException('Invalid MoMo IPN signature');
  }

  async verifyNotification(
    input: unknown,
    record: GatewayCheckoutRecord,
  ): Promise<VerifiedGatewayEvidence> {
    if (record.provider !== 'MOMO') throw new ConflictException('MoMo IPN provider conflict');
    if (
      !record.requestSnapshot ||
      !record.providerPartnerCode ||
      record.requestSnapshot.requestType !== 'captureWallet' ||
      record.requestSnapshot.autoCapture !== true
    )
      throw new ConflictException('LEGACY_RECONCILIATION_REQUIRED');
    if (
      !this.momo.verifyIpn(input, {
        partnerCode: record.providerPartnerCode,
        orderId: record.providerOrderId,
        requestId: record.providerRequestId,
        amountVnd: gatewayAmountVnd(record.amount),
        extraData: record.requestSnapshot.extraData,
      })
    )
      throw new ConflictException('MoMo IPN identity or amount conflict');
    // Read only the already authenticated scalar observation, never cast a client DTO into evidence.
    if (
      typeof input !== 'object' ||
      input === null ||
      !('resultCode' in input) ||
      !('transId' in input)
    )
      throw new ConflictException('MoMo IPN identity or amount conflict');
    const resultCode = Number(input.resultCode);
    const transId = String(input.transId);
    const outcome = classifyMomoResult(
      'PAYMENT_IPN',
      resultCode,
      record.requestSnapshot.autoCapture,
    );
    if (outcome === 'CREATE_ACCEPTED')
      throw new ConflictException('MoMo IPN identity or amount conflict');
    return new MomoVerifiedEvidence({
      provider: 'MOMO',
      checkoutId: record.checkoutId,
      tenancyId: record.tenancyId,
      createdByUserId: record.createdByUserId,
      merchantScope: record.providerPartnerCode,
      idempotencyKey: record.idempotencyKey,
      fingerprint: record.fingerprint,
      createdAt: record.createdAt,
      invoice: record.providerOrderId,
      requestId: record.providerRequestId,
      referenceCode: record.referenceCode,
      snapshot: JSON.stringify(record.requestSnapshot),
      remoteOrderId: record.providerRemoteOrderId,
      amount: record.amount,
      currency: 'VND',
      outcome,
      providerSettlementId: transId,
      stage: 'PAYMENT_IPN',
      resultCode,
      observation: JSON.stringify({ stage: 'PAYMENT_IPN', resultCode, outcome, transId }),
      replayBlocker:
        outcome === 'PENDING'
          ? 'PROVIDER_PENDING'
          : outcome === 'RETRYABLE_NON_FINAL'
            ? 'PROVIDER_CONFIGURATION_REQUIRED'
            : outcome === 'RECONCILE'
              ? 'RECONCILIATION_REQUIRED'
              : null,
    });
  }
}

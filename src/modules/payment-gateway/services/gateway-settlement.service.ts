import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { ResourceAuthorizationService } from '../../../common/auth/resource-authorization.service';
import { PersistenceUniqueViolation } from '../../../persistence/errors';
import type {
  GatewayCheckoutRecord,
  PaymentRecord,
} from '../../../persistence/ports/finance.repository';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import { GATEWAY_CLOCK, VerifiedGatewayEvidence } from '../providers/gateway-provider';

@Injectable()
export class GatewaySettlementService {
  private readonly logger = new Logger(GatewaySettlementService.name);

  constructor(
    @Inject(TRANSACTION_MANAGER) private readonly tx: TransactionManager,
    @Optional() @Inject(GATEWAY_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  async settle(evidence: VerifiedGatewayEvidence): Promise<void> {
    if (!VerifiedGatewayEvidence.isVerified(evidence))
      throw new ConflictException('Internally verified gateway evidence required');
    const data = evidence.data;
    const providerName = data.provider === 'MOMO' ? 'MoMo' : data.provider;
    const now = this.clock().toISOString();
    try {
      await this.tx.run(async (context) => {
        const { repositories } = context;
        await repositories.finance.lockGatewayCheckout(data.checkoutId);
        const locked = await repositories.finance.findGatewayCheckout(data.checkoutId);
        if (!locked) throw new NotFoundException('Gateway checkout not found');
        if (locked.provider !== data.provider)
          throw new ConflictException(`${providerName} IPN provider conflict`);
        if (
          locked.providerPartnerCode !== data.merchantScope ||
          locked.tenancyId !== data.tenancyId ||
          locked.createdByUserId !== data.createdByUserId ||
          locked.idempotencyKey !== data.idempotencyKey ||
          locked.fingerprint !== data.fingerprint ||
          locked.createdAt !== data.createdAt ||
          locked.providerOrderId !== data.invoice ||
          locked.providerRequestId !== data.requestId ||
          locked.referenceCode !== data.referenceCode ||
          locked.amount !== data.amount ||
          JSON.stringify(locked.requestSnapshot) !== data.snapshot ||
          locked.providerRemoteOrderId !== data.remoteOrderId ||
          data.currency !== 'VND' ||
          !['INITIATED', 'CREATED', 'UNKNOWN', 'FAILED', 'SUCCEEDED'].includes(locked.status)
        )
          throw new ConflictException(`${providerName} IPN identity or amount conflict`);
        const { outcome, resultCode, providerSettlementId: transId } = data;
        const success = outcome === 'PAYMENT_SUCCEEDED';
        const failure = outcome === 'FINAL_FAILURE';
        if (success && !transId)
          throw new ConflictException(`${providerName} settlement identity conflict`);
        if (locked.status === 'SUCCEEDED' || locked.status === 'FAILED') {
          if (
            (locked.status === 'FAILED' && success) ||
            (locked.status === 'SUCCEEDED' &&
              (failure || (success && locked.providerTransId !== transId)))
          ) {
            this.logger.warn({
              message: `${providerName} IPN terminal conflict`,
              checkoutId: locked.checkoutId,
              stage: data.stage,
              storedOutcome: locked.providerOutcome,
              storedResultCode: locked.providerResultCode,
              outcome,
              resultCode,
            });
            throw new ConflictException(`${providerName} IPN terminal conflict`);
          }
          if (locked.status === 'SUCCEEDED') {
            const payment =
              locked.resultingPaymentId &&
              (await repositories.finance.findPayment(locked.resultingPaymentId));
            if (
              !payment ||
              payment.tenancyId !== locked.tenancyId ||
              payment.amount !== locked.amount ||
              payment.source !== 'GATEWAY' ||
              payment.verification !== 'PROVIDER_VERIFIED'
            )
              throw new ConflictException(`${providerName} settlement requires reconciliation`);
          }
          return;
        }
        const observed: GatewayCheckoutRecord = {
          ...locked,
          providerOutcome: outcome,
          providerResultCode: resultCode,
          providerOutcomeStage: data.stage,
          lastIpnPayload: data.observation,
          lastIpnAt: now,
          updatedAt: now,
          dispatchLeaseOwner: null,
          dispatchLeaseUntil: null,
          replayBlocker: data.replayBlocker,
        };
        if (!success) {
          await repositories.finance.updateGatewayCheckout({
            ...observed,
            status: failure ? 'FAILED' : locked.status,
            terminalEvidence: failure ? data.observation : locked.terminalEvidence,
          });
          return;
        }
        const paymentId = randomUUID();
        const payment: PaymentRecord = {
          paymentId,
          tenancyId: locked.tenancyId,
          amount: locked.amount,
          source: 'GATEWAY',
          verification: 'PROVIDER_VERIFIED',
          confirmedAt: now,
          voidedOrReversedAt: null,
          correctionNote: null,
          replacementPaymentId: null,
        };
        await repositories.finance.insertPayment(payment);
        await repositories.finance.updateGatewayCheckout({
          ...observed,
          status: 'SUCCEEDED',
          resultingPaymentId: paymentId,
          providerTransId: transId,
          terminalEvidence: data.observation,
        });
        const authorization = new ResourceAuthorizationService({ run: (work) => work(context) });
        try {
          await authorization.assertCanReadTenancy(locked.createdByUserId, locked.tenancyId);
        } catch (error) {
          if (error instanceof ForbiddenException) return;
          throw error;
        }
        await repositories.notification.createNotification({
          notificationId: randomUUID(),
          recipientUserId: locked.createdByUserId,
          category: 'PAYMENT_CONFIRMED',
          messageOrPayloadReference: `payment:${paymentId}`,
          deliveryStatus: 'PENDING',
          createdAt: now,
          deliveredAt: null,
          readAt: null,
        });
      });
    } catch (error) {
      if (error instanceof PersistenceUniqueViolation)
        throw new ConflictException(`${providerName} settlement identity conflict`);
      throw error;
    }
  }
}

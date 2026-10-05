import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
  ServiceUnavailableException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { isUUID } from 'class-validator';
import { ResourceAuthorizationService } from '../../../common/auth/resource-authorization.service';
import { PersistenceUniqueViolation } from '../../../persistence/errors';
import { classifyMomoResult } from '../momo/momo-result';
import {
  isNumeric18Scale2NonNegative,
  type DecimalString,
} from '../../../common/domain/decimal-string';
import type {
  GatewayCheckoutRecord,
  PaymentRecord,
} from '../../../persistence/ports/finance.repository';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import { TenancyService } from '../../tenancy/services/tenancy.service';
import type { CreateGatewayCheckoutInput, GatewayCheckout } from '../contracts';
import {
  MOMO_PAYMENT_CLIENT,
  MomoVerificationError,
  type MomoIpnPayload,
  type MomoPaymentClient,
} from '../momo/momo-client';

function cents(v: DecimalString): bigint {
  if (!isNumeric18Scale2NonNegative(v)) {
    throw new BadRequestException(
      'Amount must be a non-negative decimal with at most two decimals',
    );
  }
  const [w, f = ''] = v.split('.');
  return BigInt(w) * 100n + BigInt(f.padEnd(2, '0'));
}

function vndInteger(amount: DecimalString): number {
  const value = cents(amount);
  if (value < 100000n || value > 5000000000n) {
    throw new BadRequestException('MoMo amount must be between 1000 and 50000000 VND');
  }
  if (value % 100n !== 0n) {
    throw new BadRequestException('MoMo amount must be a whole VND value');
  }
  return Number(value / 100n);
}

export const GATEWAY_CLOCK = Symbol('GATEWAY_CLOCK');

@Injectable()
export class PaymentGatewayService {
  constructor(
    @Inject(TenancyService) private readonly tenancyService: TenancyService,
    @Inject(TRANSACTION_MANAGER) private readonly tx: TransactionManager,
    @Inject(MOMO_PAYMENT_CLIENT) private readonly momo: MomoPaymentClient,
    @Optional()
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService = new ResourceAuthorizationService(tx),
    @Optional()
    @Inject(GATEWAY_CLOCK)
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createCheckout(
    input: CreateGatewayCheckoutInput,
    userId: string,
    idempotencyKey: string,
  ): Promise<GatewayCheckout> {
    if (!isUUID(idempotencyKey)) throw new BadRequestException('Idempotency-Key must be a UUID');
    const key = idempotencyKey.toLowerCase();
    const tenancy = await this.authz.assertCanAccessTenancy(userId, input.tenancyId);
    if (!['ACTIVE', 'ENDING'].includes(tenancy.status))
      throw new ForbiddenException('Tenancy is not writable');
    const amountVnd = vndInteger(input.amount);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(['MOMO', input.tenancyId, amountVnd]))
      .digest('hex');
    let record = await this.tx.run(({ repositories }) =>
      repositories.finance.findGatewayCheckoutByClientKey(userId, key),
    );
    if (!record) {
      const now = this.clock().toISOString();
      const checkoutId = randomUUID();
      const orderId = checkoutId.replace(/-/g, '');
      const snapshot = this.momo.snapshot(checkoutId);
      const intent: GatewayCheckoutRecord = {
        checkoutId,
        tenancyId: input.tenancyId,
        createdByUserId: userId,
        amount: `${amountVnd}.00`,
        referenceCode: `TROOI ${input.tenancyId.slice(0, 8).toUpperCase()} ${orderId.slice(-6).toUpperCase()}`,
        provider: 'MOMO',
        providerOrderId: orderId,
        providerRequestId: randomUUID().replace(/-/g, ''),
        idempotencyKey: key,
        fingerprint,
        requestSnapshot: snapshot,
        providerPartnerCode: snapshot.partnerCode,
        status: 'INITIATED',
        payUrl: null,
        deeplink: null,
        resultingPaymentId: null,
        lastIpnPayload: null,
        lastIpnAt: null,
        createdAt: now,
        updatedAt: now,
        firstDispatchAt: null,
        dispatchLeaseOwner: null,
        dispatchLeaseUntil: null,
        replayBlocker: null,
        providerOutcome: null,
        providerResultCode: null,
        providerOutcomeStage: null,
        terminalEvidence: null,
        providerTransId: null,
      };
      try {
        await this.tx.run(({ repositories }) => repositories.finance.insertGatewayCheckout(intent));
        record = intent;
      } catch (error) {
        if (!(error instanceof PersistenceUniqueViolation)) throw error;
        record = await this.tx.run(({ repositories }) =>
          repositories.finance.findGatewayCheckoutByClientKey(userId, key),
        );
        if (!record) throw error;
      }
    }
    if (record.fingerprint !== fingerprint)
      throw new ConflictException('Idempotency-Key payload differs');
    if (this.replayReason(record, userId)) return this.toCheckout(record, userId);
    const owner = randomUUID();
    const now = this.clock().toISOString();
    const acquired = await this.tx.run(async ({ repositories }) => {
      await repositories.finance.lockGatewayCheckout(record.checkoutId);
      const locked = await repositories.finance.findGatewayCheckout(record.checkoutId);
      if (!locked || this.replayReason(locked, userId)) return false;
      return repositories.finance.acquireGatewayDispatchLease(
        record.checkoutId,
        owner,
        now,
        new Date(this.clock().getTime() + 60000).toISOString(),
      );
    });
    if (!acquired) return this.findCheckout(record.checkoutId, userId);
    let outcome: string | null = null;
    let resultCode: number | null = null;
    let payUrl: string | null = null;
    let blocker: string | null = null;
    try {
      const created = await this.momo.createCaptureWallet({
        orderId: record.providerOrderId,
        requestId: record.providerRequestId,
        amountVnd: vndInteger(record.amount),
        orderInfo: record.referenceCode,
        checkoutId: record.checkoutId,
        snapshot: record.requestSnapshot!,
      });
      resultCode = created.resultCode;
      outcome = classifyMomoResult('CREATE', resultCode, record.requestSnapshot!.autoCapture);
      payUrl = outcome === 'CREATE_ACCEPTED' ? created.payUrl : null;
      if (outcome === 'PENDING') blocker = 'PROVIDER_PENDING';
      if (outcome === 'RECONCILE') blocker = 'RECONCILIATION_REQUIRED';
      if (outcome === 'RETRYABLE_NON_FINAL') blocker = 'PROVIDER_CONFIGURATION_REQUIRED';
    } catch (error) {
      if (error instanceof MomoVerificationError) blocker = 'RESPONSE_VERIFICATION_REQUIRED';
      else if (error instanceof ServiceUnavailableException)
        blocker = 'PROVIDER_CONFIGURATION_REQUIRED';
    }
    await this.tx.run(async ({ repositories }) => {
      await repositories.finance.lockGatewayCheckout(record.checkoutId);
      const locked = await repositories.finance.findGatewayCheckout(record.checkoutId);
      if (
        !locked ||
        locked.dispatchLeaseOwner !== owner ||
        locked.lastIpnAt ||
        ['FAILED', 'SUCCEEDED'].includes(locked.status)
      )
        return;
      const status =
        outcome === 'CREATE_ACCEPTED'
          ? 'CREATED'
          : outcome === 'FINAL_FAILURE'
            ? 'FAILED'
            : 'UNKNOWN';
      await repositories.finance.updateGatewayCheckout({
        ...locked,
        status,
        payUrl,
        deeplink: null,
        dispatchLeaseOwner: null,
        dispatchLeaseUntil: null,
        replayBlocker: blocker,
        providerOutcome: outcome,
        providerResultCode: resultCode,
        providerOutcomeStage: resultCode === null ? null : 'CREATE',
        terminalEvidence:
          status === 'FAILED'
            ? JSON.stringify({ stage: 'CREATE', resultCode, outcome })
            : locked.terminalEvidence,
        updatedAt: this.clock().toISOString(),
      });
    });
    return this.findCheckout(record.checkoutId, userId);
  }

  async findCheckout(id: string, userId: string): Promise<GatewayCheckout> {
    let record = await this.tx.run(({ repositories }) =>
      repositories.finance.findGatewayCheckout(id),
    );
    if (!record) throw new NotFoundException(`Gateway checkout not found: ${id}`);
    await this.authz.assertCanReadTenancy(userId, record.tenancyId);
    if (
      record.status === 'INITIATED' &&
      record.dispatchLeaseUntil &&
      new Date(record.dispatchLeaseUntil).getTime() <= this.clock().getTime()
    ) {
      record = await this.tx.run(async ({ repositories }) => {
        await repositories.finance.lockGatewayCheckout(id);
        const current = await repositories.finance.findGatewayCheckout(id);
        if (!current) throw new NotFoundException(`Gateway checkout not found: ${id}`);
        if (
          current.status !== 'INITIATED' ||
          !current.dispatchLeaseUntil ||
          new Date(current.dispatchLeaseUntil).getTime() > this.clock().getTime()
        )
          return current;
        const recovered: GatewayCheckoutRecord = {
          ...current,
          status: 'UNKNOWN',
          updatedAt: this.clock().toISOString(),
        };
        await repositories.finance.updateGatewayCheckout(recovered);
        return recovered;
      });
    }
    let writeAllowed = false;
    if (record.createdByUserId === userId) {
      try {
        const tenancy = await this.authz.assertCanAccessTenancy(userId, record.tenancyId);
        writeAllowed = ['ACTIVE', 'ENDING'].includes(tenancy.status);
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    return this.toCheckout(record, userId, writeAllowed);
  }

  private replayReason(
    record: GatewayCheckoutRecord,
    userId: string,
    writeAllowed = true,
  ): string | undefined {
    if (record.createdByUserId !== userId) return 'INTENT_OWNER_REQUIRED';
    if (!writeAllowed) return 'TENANCY_WRITE_ACCESS_REQUIRED';
    if (record.replayBlocker) return record.replayBlocker;
    if (!record.requestSnapshot) return 'LEGACY_RECONCILIATION_REQUIRED';
    if (!['INITIATED', 'UNKNOWN'].includes(record.status)) return 'CHECKOUT_NOT_REPLAYABLE';
    if (
      record.firstDispatchAt &&
      this.clock().getTime() >= new Date(record.firstDispatchAt).getTime() + 31 * 86400000
    )
      return 'IDEMPOTENCY_WINDOW_ELAPSED';
    if (
      record.dispatchLeaseUntil &&
      new Date(record.dispatchLeaseUntil).getTime() > this.clock().getTime()
    )
      return 'DISPATCH_IN_PROGRESS';
    return undefined;
  }

  async handleMomoIpn(payload: MomoIpnPayload): Promise<void> {
    if (!this.momo.verifyIpn(payload)) {
      throw new UnauthorizedException('Invalid MoMo IPN signature');
    }
    const now = new Date().toISOString();
    await this.tx.run(async ({ repositories }) => {
      const existing = await repositories.finance.findGatewayCheckoutByOrderId(payload.orderId);
      if (!existing)
        throw new NotFoundException(`Gateway checkout not found for order ${payload.orderId}`);
      await repositories.finance.lockGatewayCheckout(existing.checkoutId);
      const locked = await repositories.finance.findGatewayCheckout(existing.checkoutId);
      if (!locked)
        throw new NotFoundException(`Gateway checkout not found: ${existing.checkoutId}`);
      if (locked.status === 'SUCCEEDED' && locked.resultingPaymentId) {
        return;
      }
      const ipnAmount = String(payload.amount);
      const checkoutVnd = String(vndInteger(locked.amount));
      const failed = String(payload.resultCode) !== '0' || ipnAmount !== checkoutVnd;
      if (failed) {
        await repositories.finance.updateGatewayCheckout({
          ...locked,
          status: 'FAILED',
          lastIpnPayload: JSON.stringify(payload),
          lastIpnAt: now,
          updatedAt: now,
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
        ...locked,
        status: 'SUCCEEDED',
        resultingPaymentId: paymentId,
        lastIpnPayload: JSON.stringify(payload),
        lastIpnAt: now,
        updatedAt: now,
      });
      if (repositories.notification) {
        const participants = await repositories.tenancy?.findParticipantsByTenancy(
          locked.tenancyId,
        );
        const linked = participants?.find((p) => p.userId && p.leftAt === null);
        if (linked?.userId) {
          await repositories.notification.createNotification({
            notificationId: randomUUID(),
            recipientUserId: linked.userId,
            category: 'PAYMENT_CONFIRMED',
            messageOrPayloadReference: `payment:${paymentId}`,
            deliveryStatus: 'PENDING',
            createdAt: now,
            deliveredAt: null,
            readAt: null,
          });
        }
      }
    });
  }

  private toCheckout(
    record: GatewayCheckoutRecord,
    userId: string,
    writeAllowed = true,
  ): GatewayCheckout {
    const reason = this.replayReason(record, userId, writeAllowed);
    return {
      replayAllowed: !reason,
      ...(reason ? { replayBlockedReason: reason } : {}),
      id: record.checkoutId,
      tenancyId: record.tenancyId,
      amount: record.amount,
      referenceCode: record.referenceCode,
      provider: 'MOMO',
      status: record.status,
      createdAt: record.createdAt,
      ...(record.payUrl ? { payUrl: record.payUrl } : {}),
      ...(record.deeplink ? { deeplink: record.deeplink } : {}),
      ...(record.resultingPaymentId ? { resultingPaymentId: record.resultingPaymentId } : {}),
    };
  }
}

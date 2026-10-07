import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { isUUID } from 'class-validator';
import { ResourceAuthorizationService } from '../../../common/auth/resource-authorization.service';
import { PersistenceUniqueViolation } from '../../../persistence/errors';
import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import { TenancyService } from '../../tenancy/services/tenancy.service';
import type { CreateGatewayCheckoutInput, GatewayCheckout } from '../contracts';
import type { MomoIpnPayload } from '../momo/momo-client';
import { GATEWAY_CLOCK, gatewayAmountVnd } from '../providers/gateway-provider';
import { GatewayProviderRegistry } from '../providers/gateway-provider.registry';
import { GatewaySettlementService } from './gateway-settlement.service';
export { GATEWAY_CLOCK } from '../providers/gateway-provider';

@Injectable()
export class PaymentGatewayService {
  constructor(
    @Inject(TenancyService) private readonly tenancyService: TenancyService,
    @Inject(TRANSACTION_MANAGER) private readonly tx: TransactionManager,
    @Inject(GatewayProviderRegistry) private readonly providers: GatewayProviderRegistry,
    @Inject(GatewaySettlementService) private readonly settlement: GatewaySettlementService,
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
    const provider = input.provider === undefined ? 'MOMO' : input.provider;
    if (provider !== 'MOMO' && provider !== 'SEPAY' && provider !== 'DEMO')
      throw new BadRequestException('Invalid gateway provider');
    if (!isUUID(idempotencyKey)) throw new BadRequestException('Idempotency-Key must be a UUID');
    const key = idempotencyKey.toLowerCase();
    const tenancy = await this.authz.assertCanAccessTenancy(userId, input.tenancyId);
    if (!['ACTIVE', 'ENDING'].includes(tenancy.status))
      throw new ForbiddenException('Tenancy is not writable');
    const amountVnd = gatewayAmountVnd(input.amount);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([provider, input.tenancyId, amountVnd]))
      .digest('hex');
    let record = await this.tx.run(({ repositories }) =>
      repositories.finance.findGatewayCheckoutByClientKey(userId, key),
    );
    if (!record) {
      const adapter = this.providers.require(provider);
      const now = this.clock().toISOString();
      const checkoutId = randomUUID();
      const prepared = adapter.prepareIntent(input, checkoutId);
      const { merchantScope, invoice: orderId, requestId, ...binding } = prepared;
      const intent: GatewayCheckoutRecord = {
        ...binding,
        checkoutId,
        tenancyId: input.tenancyId,
        createdByUserId: userId,
        amount: `${amountVnd}.00`,
        referenceCode: `TROOI ${input.tenancyId.slice(0, 8).toUpperCase()} ${orderId.slice(-6).toUpperCase()}`,
        providerOrderId: orderId,
        providerRequestId: requestId,
        idempotencyKey: key,
        fingerprint,
        providerPartnerCode: merchantScope,
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
        providerRemoteOrderId: null,
        handoffClaimedAt: null,
        handoffAttempt: 0,
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
    const {
      ready,
      outcome,
      resultCode,
      payUrl,
      replayBlocker: blocker,
    } = await this.providers.require(record.provider).prepareHandoff(record);
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
      const status = ready ? 'CREATED' : outcome === 'FINAL_FAILURE' ? 'FAILED' : 'UNKNOWN';
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
      record.provider === 'MOMO' &&
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
    const adapter = this.providers.find(record.provider);
    return adapter ? adapter.replayReason(record, this.clock()) : 'PROVIDER_UNAVAILABLE';
  }

  async handleMomoIpn(payload: MomoIpnPayload): Promise<void> {
    const adapter = this.providers.require('MOMO');
    adapter.authenticateNotification(payload);
    const record = await this.tx.run(({ repositories }) =>
      repositories.finance.findGatewayCheckoutByOrderId(payload.orderId),
    );
    if (!record) throw new NotFoundException('Gateway checkout not found');
    const evidence = await adapter.verifyNotification(payload, record);
    await this.settlement.settle(evidence);
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
      provider: record.provider,
      status: record.status,
      createdAt: record.createdAt,
      ...(record.payUrl ? { payUrl: record.payUrl } : {}),
      ...(record.deeplink ? { deeplink: record.deeplink } : {}),
      ...(record.resultingPaymentId ? { resultingPaymentId: record.resultingPaymentId } : {}),
    };
  }
}

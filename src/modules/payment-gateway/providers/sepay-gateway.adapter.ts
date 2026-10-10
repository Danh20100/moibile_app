import {
  ConflictException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import type { SepayRequestSnapshot } from '../../../persistence/ports/gateway-checkout.types';
import type { CreateGatewayCheckoutInput } from '../contracts';
import {
  SEPAY_PRODUCTION_API_ORIGIN,
  SEPAY_PRODUCTION_CHECKOUT_URL,
  sepayProductionFields,
  signSepayFields,
} from '../sepay/sepay-form';
import {
  SEPAY_HANDOFF_TTL_MS,
  signSepayHandoff,
  verifySepayHandoff,
} from '../sepay/sepay-handoff-token';
import { readSepayIpnInvoice, sepaySecretsMatch } from '../sepay/sepay-ipn';
import { SEPAY_ORDER_READER, type SepayOrderReader } from '../sepay/sepay-order-client';
import type { SepayProductionConfig } from '../sepay/sepay-production-config';
import {
  GATEWAY_CLOCK,
  gatewayAmountVnd,
  VerifiedGatewayEvidence,
  type GatewayProviderAdapter,
  type PreparedGatewayIntent,
  type PreparedHandoff,
} from './gateway-provider';

export const SEPAY_PRODUCTION_CONFIG = Symbol('SEPAY_PRODUCTION_CONFIG');

class SepayVerifiedEvidence extends VerifiedGatewayEvidence {
  constructor(data: VerifiedGatewayEvidence['data']) {
    super(data);
  }
}

@Injectable()
export class SepayGatewayAdapter implements GatewayProviderAdapter {
  readonly provider = 'SEPAY' as const;

  constructor(
    @Optional()
    @Inject(SEPAY_PRODUCTION_CONFIG)
    private readonly config: SepayProductionConfig | null = null,
    @Optional() @Inject(SEPAY_ORDER_READER) private readonly orders?: SepayOrderReader,
    @Optional() @Inject(GATEWAY_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  isAvailable(): boolean {
    return this.config?.environment === 'production';
  }

  private requireConfig(): SepayProductionConfig {
    if (!this.config) throw new ServiceUnavailableException('SEPAY checkout is unavailable');
    return this.config;
  }

  prepareIntent(_input: CreateGatewayCheckoutInput, checkoutId: string): PreparedGatewayIntent {
    const config = this.requireConfig();
    const invoice = `TROOI-SEPAY-${checkoutId.replace(/-/g, '')}`;
    const requestSnapshot: SepayRequestSnapshot = {
      environment: 'production',
      merchantId: config.merchantId,
      endpoint: SEPAY_PRODUCTION_CHECKOUT_URL,
      apiOrigin: SEPAY_PRODUCTION_API_ORIGIN,
      operation: 'PURCHASE',
      paymentMethod: 'BANK_TRANSFER',
      currency: 'VND',
      successUrl: `${config.publicBaseUrl}/api/v1/finance/checkouts/sepay/return/success`,
      errorUrl: `${config.publicBaseUrl}/api/v1/finance/checkouts/sepay/return/error`,
      cancelUrl: `${config.publicBaseUrl}/api/v1/finance/checkouts/sepay/return/cancel`,
    };
    return Object.freeze({
      provider: 'SEPAY',
      requestSnapshot,
      merchantScope: `production:${config.merchantId}`,
      invoice,
      requestId: `SEPAY-REQ-${checkoutId.replace(/-/g, '')}`,
    });
  }

  async prepareHandoff(record: GatewayCheckoutRecord): Promise<PreparedHandoff> {
    const config = this.requireConfig();
    this.assertIntent(record);
    const token = signSepayHandoff(
      record.checkoutId,
      this.clock().getTime() + SEPAY_HANDOFF_TTL_MS,
      config.handoffSigningKey,
    );
    return Object.freeze({
      ready: true,
      payUrl: `${config.publicBaseUrl}/api/v1/finance/checkouts/sepay/handoff?token=${encodeURIComponent(token)}`,
      outcome: 'CREATE_ACCEPTED',
      resultCode: null,
      replayBlocker: null,
    });
  }

  replayReason(record: GatewayCheckoutRecord, now: Date): string | undefined {
    void now;
    if (!this.isAvailable() || record.provider !== 'SEPAY') return 'PROVIDER_UNAVAILABLE';
    try {
      this.assertIntent(record);
    } catch {
      return 'INTENT_BINDING_REQUIRED';
    }
    if (record.replayBlocker) return record.replayBlocker;
    if (record.status === 'INITIATED') return undefined;
    return 'CHECKOUT_NOT_REPLAYABLE';
  }

  authenticateNotification(input: unknown): void {
    if (!this.config) throw new ServiceUnavailableException('SePay IPN is unavailable');
    const provided = typeof input === 'string' ? input : '';
    if (!sepaySecretsMatch(provided, this.config.ipnSecretKey)) {
      throw new UnauthorizedException('Invalid SePay IPN secret');
    }
  }

  async verifyNotification(
    input: unknown,
    record: GatewayCheckoutRecord,
  ): Promise<VerifiedGatewayEvidence> {
    readSepayIpnInvoice(input);
    const evidence = await this.reconcile(record);
    if (evidence === 'pending' || evidence === 'uncertain') {
      throw new ServiceUnavailableException('SePay order is not uniquely paid');
    }
    return evidence;
  }

  checkoutIdFromHandoff(token: string, now: Date): string {
    return verifySepayHandoff(token, this.requireConfig().handoffSigningKey, now).checkoutId;
  }

  assertStoredIntent(record: GatewayCheckoutRecord): void {
    this.assertIntent(record);
  }

  checkoutForm(record: GatewayCheckoutRecord): { action: string; fields: Record<string, string> } {
    const config = this.requireConfig();
    const snapshot = this.assertIntent(record);
    const fields = sepayProductionFields({
      merchantId: config.merchantId,
      amountVnd: gatewayAmountVnd(record.amount),
      invoice: record.providerOrderId,
      description: record.referenceCode,
      successUrl: snapshot.successUrl,
      errorUrl: snapshot.errorUrl,
      cancelUrl: snapshot.cancelUrl,
    });
    return {
      action: SEPAY_PRODUCTION_CHECKOUT_URL,
      fields: { ...fields, signature: signSepayFields(fields, config.secretKey) },
    };
  }

  async reconcile(
    record: GatewayCheckoutRecord,
  ): Promise<SepayVerifiedEvidence | 'pending' | 'uncertain'> {
    this.requireConfig();
    this.assertIntent(record);
    if (!this.orders) return 'uncertain';
    const read = await this.orders.readInvoice(record.providerOrderId);
    if (read.kind !== 'paid') return read.kind;
    if (
      read.invoice !== record.providerOrderId ||
      read.amount !== record.amount ||
      read.currency !== 'VND' ||
      read.paymentMethod !== 'BANK_TRANSFER' ||
      read.remoteOrderId === record.providerOrderId
    )
      return 'uncertain';
    if (record.providerRemoteOrderId && record.providerRemoteOrderId !== read.remoteOrderId)
      return 'uncertain';
    return new SepayVerifiedEvidence({
      provider: 'SEPAY',
      checkoutId: record.checkoutId,
      tenancyId: record.tenancyId,
      createdByUserId: record.createdByUserId,
      idempotencyKey: record.idempotencyKey,
      fingerprint: record.fingerprint,
      createdAt: record.createdAt,
      merchantScope: record.providerPartnerCode ?? '',
      invoice: record.providerOrderId,
      requestId: record.providerRequestId,
      referenceCode: record.referenceCode,
      snapshot: JSON.stringify(record.requestSnapshot),
      remoteOrderId: read.remoteOrderId,
      amount: record.amount,
      currency: 'VND',
      outcome: 'PAYMENT_SUCCEEDED',
      providerSettlementId: read.transactionId,
      stage: 'RECONCILIATION',
      resultCode: null,
      observation: JSON.stringify({
        source: 'sepay-order-detail',
        orderStatus: 'CAPTURED',
        remoteOrderId: read.remoteOrderId,
        transactionId: read.transactionId,
      }),
      replayBlocker: null,
    });
  }

  private assertIntent(record: GatewayCheckoutRecord): SepayRequestSnapshot {
    const config = this.requireConfig();
    const snapshot = record.requestSnapshot;
    const identity = record.checkoutId.replace(/-/g, '');
    if (
      record.provider !== 'SEPAY' ||
      !isUUID(record.checkoutId) ||
      snapshot === null ||
      !('environment' in snapshot) ||
      snapshot.environment !== 'production' ||
      snapshot.merchantId !== config.merchantId ||
      snapshot.endpoint !== SEPAY_PRODUCTION_CHECKOUT_URL ||
      snapshot.apiOrigin !== SEPAY_PRODUCTION_API_ORIGIN ||
      snapshot.operation !== 'PURCHASE' ||
      snapshot.paymentMethod !== 'BANK_TRANSFER' ||
      snapshot.currency !== 'VND' ||
      snapshot.successUrl !==
        `${config.publicBaseUrl}/api/v1/finance/checkouts/sepay/return/success` ||
      snapshot.errorUrl !== `${config.publicBaseUrl}/api/v1/finance/checkouts/sepay/return/error` ||
      snapshot.cancelUrl !==
        `${config.publicBaseUrl}/api/v1/finance/checkouts/sepay/return/cancel` ||
      record.providerPartnerCode !== `production:${config.merchantId}` ||
      record.providerOrderId !== `TROOI-SEPAY-${identity}` ||
      record.providerRequestId !== `SEPAY-REQ-${identity}` ||
      record.providerResultCode !== null
    )
      throw new ConflictException('SePay checkout identity conflict');
    gatewayAmountVnd(record.amount);
    return snapshot;
  }
}

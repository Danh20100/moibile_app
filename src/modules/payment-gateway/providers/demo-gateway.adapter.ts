import { createHash } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import type { CreateGatewayCheckoutInput } from '../contracts';
import { loadDemoConfig, type DemoConfig } from '../demo/demo-config';
import {
  demoIntentDigest,
  signDemoCapability,
  verifyDemoCapability,
  type DemoCapability,
} from '../demo/demo-capability';
import {
  GATEWAY_CLOCK,
  gatewayAmountVnd,
  VerifiedGatewayEvidence,
  type GatewayProviderAdapter,
  type PreparedGatewayIntent,
  type PreparedHandoff,
} from './gateway-provider';

export const DEMO_CONFIG = Symbol('DEMO_CONFIG');

class DemoVerifiedEvidence extends VerifiedGatewayEvidence {
  constructor(data: VerifiedGatewayEvidence['data']) {
    super(data);
  }
}

@Injectable()
export class DemoGatewayAdapter implements GatewayProviderAdapter {
  readonly provider = 'DEMO';

  constructor(
    @Optional() @Inject(GATEWAY_CLOCK) private readonly clock: () => Date = () => new Date(),
    @Optional()
    @Inject(DEMO_CONFIG)
    private readonly config: () => DemoConfig | null = () => loadDemoConfig(process.env),
  ) {}

  isAvailable(): boolean {
    return this.config() !== null;
  }

  private requireConfig(): DemoConfig {
    const config = this.config();
    if (!config) throw new ServiceUnavailableException('DEMO checkout is unavailable');
    return config;
  }

  prepareIntent(_input: CreateGatewayCheckoutInput, checkoutId: string): PreparedGatewayIntent {
    this.requireConfig();
    const identity = checkoutId.replace(/-/g, '');
    return Object.freeze({
      provider: 'DEMO',
      requestSnapshot: null,
      merchantScope: 'demo:local',
      invoice: `TROOI-DEMO-${identity}`,
      requestId: `DEMO-REQ-${identity}`,
    });
  }

  private assertIntent(record: GatewayCheckoutRecord): void {
    const identity = record.checkoutId.replace(/-/g, '');
    if (
      record.provider !== 'DEMO' ||
      !isUUID(record.checkoutId) ||
      record.checkoutId !== record.checkoutId.toLowerCase() ||
      record.providerPartnerCode !== 'demo:local' ||
      record.providerOrderId !== `TROOI-DEMO-${identity}` ||
      record.providerRequestId !== `DEMO-REQ-${identity}` ||
      record.requestSnapshot !== null ||
      record.providerRemoteOrderId !== null ||
      !record.idempotencyKey ||
      !isUUID(record.idempotencyKey) ||
      record.idempotencyKey !== record.idempotencyKey.toLowerCase() ||
      record.fingerprint !==
        createHash('sha256')
          .update(JSON.stringify(['DEMO', record.tenancyId, gatewayAmountVnd(record.amount)]))
          .digest('hex') ||
      (record.providerTransId !== null && record.providerTransId !== `DEMO-${identity}`)
    )
      throw new ConflictException('Demo checkout identity conflict');
  }

  async prepareHandoff(record: GatewayCheckoutRecord): Promise<PreparedHandoff> {
    const config = this.requireConfig();
    this.assertIntent(record);
    if (!['INITIATED', 'CREATED'].includes(record.status))
      throw new ConflictException('Demo checkout is terminal');
    return Object.freeze({
      ready: true,
      payUrl: `${config.publicBaseUrl}/api/v1/finance/checkouts/demo/pay/${signDemoCapability(record, config, this.clock())}`,
      outcome: 'CREATE_ACCEPTED',
      resultCode: null,
      replayBlocker: null,
    });
  }

  replayReason(record: GatewayCheckoutRecord, now: Date): string | undefined {
    const config = this.config();
    if (!config || record.provider !== 'DEMO') return 'PROVIDER_UNAVAILABLE';
    try {
      this.assertIntent(record);
    } catch {
      return 'INTENT_BINDING_REQUIRED';
    }
    if (!['INITIATED', 'CREATED'].includes(record.status)) return 'CHECKOUT_NOT_REPLAYABLE';
    if (record.replayBlocker) return record.replayBlocker;
    if (record.dispatchLeaseUntil && new Date(record.dispatchLeaseUntil).getTime() > now.getTime())
      return 'DISPATCH_IN_PROGRESS';
    if (record.status === 'CREATED' && record.payUrl) {
      const prefix = `${config.publicBaseUrl}/api/v1/finance/checkouts/demo/pay/`;
      try {
        if (record.payUrl.startsWith(prefix)) {
          const capability = verifyDemoCapability(record.payUrl.slice(prefix.length), config, now);
          if (
            capability.checkoutId === record.checkoutId &&
            capability.intentDigest === demoIntentDigest(record)
          )
            return 'CHECKOUT_NOT_REPLAYABLE';
        }
      } catch {
        // Authenticated same-key creation may renew an expired or invalidated local handoff.
      }
    }
    return undefined;
  }

  readCapability(token: string): DemoCapability {
    return verifyDemoCapability(token, this.requireConfig(), this.clock());
  }

  verifyCompletion(token: string, record: GatewayCheckoutRecord): VerifiedGatewayEvidence {
    const capability = this.readCapability(token);
    this.assertIntent(record);
    if (
      capability.checkoutId !== record.checkoutId ||
      capability.intentDigest !== demoIntentDigest(record) ||
      !['CREATED', 'SUCCEEDED'].includes(record.status)
    )
      throw new ConflictException('Demo checkout capability conflict');
    const transId = `DEMO-${record.checkoutId.replace(/-/g, '')}`;
    return new DemoVerifiedEvidence({
      provider: 'DEMO',
      checkoutId: record.checkoutId,
      tenancyId: record.tenancyId,
      createdByUserId: record.createdByUserId,
      idempotencyKey: record.idempotencyKey,
      fingerprint: record.fingerprint,
      createdAt: record.createdAt,
      merchantScope: 'demo:local',
      invoice: record.providerOrderId,
      requestId: record.providerRequestId,
      referenceCode: record.referenceCode,
      snapshot: 'null',
      remoteOrderId: null,
      amount: record.amount,
      currency: 'VND',
      outcome: 'PAYMENT_SUCCEEDED',
      providerSettlementId: transId,
      stage: 'DEMO_CONFIRMATION',
      resultCode: null,
      observation: JSON.stringify({
        stage: 'DEMO_CONFIRMATION',
        resultCode: null,
        outcome: 'PAYMENT_SUCCEEDED',
        transId,
      }),
      replayBlocker: null,
    });
  }

  authenticateNotification(_input: unknown): void {
    throw new ServiceUnavailableException('Demo provider callbacks are unsupported');
  }

  async verifyNotification(
    _input: unknown,
    _record: GatewayCheckoutRecord,
  ): Promise<VerifiedGatewayEvidence> {
    throw new ServiceUnavailableException('Demo provider callbacks are unsupported');
  }
}

import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import { demoIntentDigest } from '../demo/demo-capability';
import { loadDemoConfig, type DemoConfig } from '../demo/demo-config';
import { DEMO_CONFIG, DemoGatewayAdapter } from '../providers/demo-gateway.adapter';
import { gatewayAmountVnd, type VerifiedGatewayEvidence } from '../providers/gateway-provider';
import { GatewaySettlementService } from './gateway-settlement.service';

@Injectable()
export class DemoPaymentService {
  constructor(
    @Inject(TRANSACTION_MANAGER) private readonly tx: TransactionManager,
    private readonly demo: DemoGatewayAdapter,
    private readonly settlement: GatewaySettlementService,
    @Optional()
    @Inject(DEMO_CONFIG)
    private readonly config: () => DemoConfig | null = () => loadDemoConfig(process.env),
  ) {}

  async readPage(token: string): Promise<GatewayCheckoutRecord> {
    const capability = this.demo.readCapability(token);
    const record = await this.tx.run(({ repositories }) =>
      repositories.finance.findGatewayCheckout(capability.checkoutId),
    );
    if (!record) throw new NotFoundException('Demo checkout not found');
    const identity = capability.checkoutId.replace(/-/g, '');
    let amountVnd: number;
    try {
      amountVnd = gatewayAmountVnd(record.amount);
    } catch {
      throw new ConflictException('Demo checkout identity conflict');
    }
    if (
      record.checkoutId !== capability.checkoutId ||
      record.provider !== 'DEMO' ||
      capability.intentDigest !== demoIntentDigest(record) ||
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
          .update(JSON.stringify(['DEMO', record.tenancyId, amountVnd]))
          .digest('hex') ||
      (record.providerTransId !== null && record.providerTransId !== `DEMO-${identity}`) ||
      !['CREATED', 'SUCCEEDED'].includes(record.status) ||
      (record.status === 'SUCCEEDED' &&
        (!record.resultingPaymentId || record.providerTransId !== `DEMO-${identity}`))
    )
      throw new ConflictException('Demo checkout identity conflict');
    return record;
  }

  async confirm(token: string, origin?: string): Promise<void> {
    const capability = this.demo.readCapability(token);
    if (origin !== undefined) {
      const config = this.config();
      if (!config) throw new ServiceUnavailableException('DEMO checkout is unavailable');
      if (origin !== config.publicBaseUrl) throw new ForbiddenException('Invalid demo origin');
    }
    const record = await this.tx.run(({ repositories }) =>
      repositories.finance.findGatewayCheckout(capability.checkoutId),
    );
    if (!record) throw new NotFoundException('Demo checkout not found');
    let evidence: VerifiedGatewayEvidence;
    try {
      evidence = this.demo.verifyCompletion(token, record);
    } catch (error) {
      if (error instanceof BadRequestException)
        throw new ConflictException('Demo checkout identity conflict');
      throw error;
    }
    await this.settlement.settle(evidence);
  }
}

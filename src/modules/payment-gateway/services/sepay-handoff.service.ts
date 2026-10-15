import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { GatewayCheckoutRecord } from '../../../persistence/ports/finance.repository';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import { GATEWAY_CLOCK } from '../providers/gateway-provider';
import { SepayGatewayAdapter } from '../providers/sepay-gateway.adapter';

export type SepayHandoffView =
  | { kind: 'ready'; record: GatewayCheckoutRecord }
  | { kind: 'issued'; record: GatewayCheckoutRecord }
  | { kind: 'form'; record: GatewayCheckoutRecord; action: string; fields: Record<string, string> };

@Injectable()
export class SepayHandoffService {
  constructor(
    @Inject(TRANSACTION_MANAGER) private readonly tx: TransactionManager,
    @Inject(SepayGatewayAdapter) private readonly sepay: SepayGatewayAdapter,
    @Optional() @Inject(GATEWAY_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  async read(token: string): Promise<SepayHandoffView> {
    const record = await this.load(token);
    if (record.status === 'CREATED' && record.handoffAttempt === 0)
      return { kind: 'ready', record };
    return { kind: 'issued', record };
  }

  async release(token: string): Promise<SepayHandoffView> {
    const record = await this.load(token);
    if (record.status !== 'CREATED' || record.handoffAttempt !== 0)
      return { kind: 'issued', record };
    const now = this.clock().toISOString();
    const claimed = await this.tx.run(({ repositories }) =>
      repositories.finance.claimGatewayHandoff(record.checkoutId, 0, now),
    );
    if (!claimed) return { kind: 'issued', record };
    const locked = await this.tx.run(({ repositories }) =>
      repositories.finance.findGatewayCheckout(record.checkoutId),
    );
    if (!locked) throw new NotFoundException('Gateway checkout not found');
    const form = this.sepay.checkoutForm(locked);
    return { kind: 'form', record: locked, action: form.action, fields: form.fields };
  }

  private async load(token: string): Promise<GatewayCheckoutRecord> {
    if (!this.sepay.isAvailable())
      throw new ServiceUnavailableException('SEPAY checkout is unavailable');
    const checkoutId = this.sepay.checkoutIdFromHandoff(token, this.clock());
    const record = await this.tx.run(({ repositories }) =>
      repositories.finance.findGatewayCheckout(checkoutId),
    );
    if (!record) throw new NotFoundException('Gateway checkout not found');
    this.sepay.assertStoredIntent(record);
    return record;
  }
}

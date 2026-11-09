import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';

import type { GatewayProvider } from '../../../persistence/ports/gateway-checkout.types';
import type { GatewayProviderAdapter } from './gateway-provider';
import { MomoGatewayAdapter } from './momo-gateway.adapter';
import { DemoGatewayAdapter } from './demo-gateway.adapter';
import { SepayGatewayAdapter } from './sepay-gateway.adapter';

@Injectable()
export class GatewayProviderRegistry {
  private readonly adapters: Record<GatewayProvider, GatewayProviderAdapter | null>;

  constructor(
    @Optional() @Inject(MomoGatewayAdapter) momo?: MomoGatewayAdapter,
    @Optional() @Inject(DemoGatewayAdapter) private readonly demo?: DemoGatewayAdapter,
    @Optional() @Inject(SepayGatewayAdapter) private readonly sepay?: SepayGatewayAdapter,
  ) {
    this.adapters = { MOMO: momo ?? null, SEPAY: null, DEMO: null };
  }

  find(provider: GatewayProvider): GatewayProviderAdapter | null {
    if (provider === 'DEMO') return this.demo?.isAvailable() ? this.demo : null;
    if (provider === 'SEPAY') return this.sepay?.isAvailable() ? this.sepay : null;
    return this.adapters[provider];
  }

  require(provider: GatewayProvider): GatewayProviderAdapter {
    const adapter = this.find(provider);
    if (!adapter) throw new ServiceUnavailableException(`${provider} checkout is unavailable`);
    return adapter;
  }
}

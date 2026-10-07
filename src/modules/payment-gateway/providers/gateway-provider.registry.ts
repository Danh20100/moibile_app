import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { GatewayProvider } from '../../../persistence/ports/gateway-checkout.types';
import type { GatewayProviderAdapter } from './gateway-provider';
import { MomoGatewayAdapter } from './momo-gateway.adapter';

@Injectable()
export class GatewayProviderRegistry {
  private readonly adapters: Record<GatewayProvider, GatewayProviderAdapter | null>;

  constructor(@Inject(MomoGatewayAdapter) momo: MomoGatewayAdapter) {
    this.adapters = { MOMO: momo, SEPAY: null };
  }

  find(provider: GatewayProvider): GatewayProviderAdapter | null {
    return this.adapters[provider];
  }

  require(provider: GatewayProvider): GatewayProviderAdapter {
    const adapter = this.find(provider);
    if (!adapter) throw new ServiceUnavailableException(`${provider} checkout is unavailable`);
    return adapter;
  }
}

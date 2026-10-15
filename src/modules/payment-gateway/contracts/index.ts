import type { DecimalString } from '../../../common/domain/decimal-string';
import type { GatewayCheckoutStatus } from '../../../persistence/ports/finance.repository';
import type { GatewayProvider } from '../../../persistence/ports/gateway-checkout.types';

export type { GatewayCheckoutStatus };

export interface GatewayCheckout {
  replayAllowed: boolean;
  replayBlockedReason?: string;
  id: string;
  tenancyId: string;
  amount: DecimalString;
  referenceCode: string;
  provider: GatewayProvider;
  status: GatewayCheckoutStatus;
  payUrl?: string;
  deeplink?: string;
  resultingPaymentId?: string;
  createdAt: string;
}

export interface CreateGatewayCheckoutInput {
  provider?: GatewayProvider;
  tenancyId: string;
  amount: DecimalString;
}

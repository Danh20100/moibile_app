import type { DecimalString } from '../../../common/domain/decimal-string';
import type { GatewayCheckoutStatus } from '../../../persistence/ports/finance.repository';

export type { GatewayCheckoutStatus };

export interface GatewayCheckout {
  id: string;
  tenancyId: string;
  amount: DecimalString;
  referenceCode: string;
  provider: 'MOMO';
  status: GatewayCheckoutStatus;
  payUrl?: string;
  deeplink?: string;
  resultingPaymentId?: string;
  createdAt: string;
}

export interface CreateGatewayCheckoutInput {
  tenancyId: string;
  amount: DecimalString;
}

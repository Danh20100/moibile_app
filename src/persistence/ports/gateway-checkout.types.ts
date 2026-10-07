export type GatewayProvider = 'MOMO' | 'SEPAY' | 'DEMO';

export interface MomoRequestSnapshot {
  partnerCode: string;
  endpoint: string;
  ipnUrl: string;
  redirectUrl: string;
  extraData: string;
  requestType: 'captureWallet';
  autoCapture: true;
}

// Local Sandbox storage binding; provider acceptance and evidence identity remain gated.
export interface SepayRequestSnapshot {
  environment: 'sandbox';
  merchantId: string;
  endpoint: 'https://pay-sandbox.sepay.vn/v1/checkout/init';
  apiOrigin: 'https://pgapi-sandbox.sepay.vn';
  operation: 'PURCHASE';
  paymentMethod: 'BANK_TRANSFER';
  currency: 'VND';
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

export type GatewaySnapshotBinding =
  | { provider: 'MOMO'; requestSnapshot: MomoRequestSnapshot | null }
  | { provider: 'SEPAY'; requestSnapshot: SepayRequestSnapshot | null }
  | { provider: 'DEMO'; requestSnapshot: null };

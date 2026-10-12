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

interface SepaySnapshotFields {
  merchantId: string;
  operation: 'PURCHASE';
  paymentMethod: 'BANK_TRANSFER';
  currency: 'VND';
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

// Local storage binding. Sandbox and production hosts are not interchangeable.
export type SepayRequestSnapshot = SepaySnapshotFields &
  (
    | {
        environment: 'sandbox';
        endpoint: 'https://pay-sandbox.sepay.vn/v1/checkout/init';
        apiOrigin: 'https://pgapi-sandbox.sepay.vn';
      }
    | {
        environment: 'production';
        endpoint: 'https://pay.sepay.vn/v1/checkout/init';
        apiOrigin: 'https://pgapi.sepay.vn';
      }
  );

export type GatewaySnapshotBinding =
  | { provider: 'MOMO'; requestSnapshot: MomoRequestSnapshot | null }
  | { provider: 'SEPAY'; requestSnapshot: SepayRequestSnapshot | null }
  | { provider: 'DEMO'; requestSnapshot: null };

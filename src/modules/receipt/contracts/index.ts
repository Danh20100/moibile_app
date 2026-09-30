export type ReceiptStatus = 'ISSUED' | 'VOIDED';

export interface ReceiptRecord {
  id: string;
  paymentId: string;
  status: ReceiptStatus;
  issuedAt: string;
  voidedAt?: string;
  replacementReceiptId?: string;
}

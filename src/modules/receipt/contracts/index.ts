export type ReceiptStatus = 'recorded' | 'confirmed';

export interface ReceiptReference {
  receiptId: string;
}

export interface ReceiptRecord {
  id: string;
  billingCycleId: string;
  tenancyId: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  status: ReceiptStatus;
  note?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

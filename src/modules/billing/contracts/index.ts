export type BillingStatus = 'upcoming' | 'due' | 'partial' | 'overdue' | 'paid';

export interface BillingCycleReference {
  billingCycleId: string;
}

export interface BillingCharge {
  type: string; // e.g. 'rent', 'electricity', 'water', 'service'
  description: string;
  amount: number;
}

export interface BillingCycle {
  id: string;
  tenancyId: string;
  roomId: string;
  cycleMonth: string; // e.g. '2026-10'
  charges: BillingCharge[];
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  dueDate: string;
  status: BillingStatus;
  createdAt: string;
  updatedAt: string;
}

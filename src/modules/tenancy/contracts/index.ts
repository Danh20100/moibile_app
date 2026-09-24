export type TenancyStatus = 'draft' | 'active' | 'ending' | 'ended';

export interface TenancyReference {
  tenancyId: string;
}

export interface TenancyTerms {
  monthlyRent: number;
  depositAmount: number;
  paymentDueDay: number;
  startDate: string;
  endDate?: string;
}

export interface TenancyProfile {
  id: string;
  roomId: string;
  tenantId: string;
  terms: TenancyTerms;
  status: TenancyStatus;
  createdAt: string;
  updatedAt: string;
}

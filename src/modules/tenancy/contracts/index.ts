export type TenancyStatus = 'draft' | 'active' | 'ending' | 'ended' | 'cancelled';

export type TenancyEndReason =
  | 'TERM_ENDED'
  | 'TENANT_INITIATED'
  | 'OPERATOR_INITIATED'
  | 'MUTUAL'
  | 'OTHER';

export interface TenancyReference {
  tenancyId: string;
}

export interface TenancyProfile {
  id: string;
  roomId: string;
  status: TenancyStatus;
  startedAt?: string;
  endedAt?: string;
  endReason?: TenancyEndReason;
}

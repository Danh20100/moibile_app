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

import type { DecimalString } from '../../../common/domain/decimal-string';

export type TenancyParticipantRole = 'PRIMARY' | 'OCCUPANT';

export interface TenancyParticipant {
  id: string;
  tenancyId: string;
  userId?: string;
  role: TenancyParticipantRole;
  joinedAt: string;
  leftAt?: string;
}

export interface AddTenancyParticipantInput {
  tenancyId: string;
  userId?: string;
  role: TenancyParticipantRole;
  joinedAt: string;
}

export interface TenancyTerms {
  id: string;
  tenancyId: string;
  version: number;
  rentAmount: DecimalString;
  agreedDepositRequirement: DecimalString;
  termStart: string;
  termEnd: string;
  billingDayOrDueDateRule: unknown;
  electricityArrangement: unknown;
  waterArrangement: unknown;
  minimalRentalConditions: unknown;
  effectiveFromCycleBoundary: string;
}

export interface CreateTenancyTermsInput extends Omit<TenancyTerms, 'id'> {}

export interface TermsAcknowledgement {
  id: string;
  tenancyTermsId: string;
  tenancyParticipantId: string;
  userId: string;
  acknowledgedAt: string;
}

export interface CreateTermsAcknowledgementInput {
  tenancyTermsId: string;
  tenancyParticipantId: string;
  userId: string;
  acknowledgedAt: string;
}

export interface TenancyNotice {
  id: string;
  tenancyId: string;
  noticeType: string;
  issuedByUserId: string;
  contentOrNote: string;
  issuedAt: string;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
}

export interface IssueTenancyNoticeInput extends Omit<
  TenancyNotice,
  'id' | 'acknowledgedByUserId' | 'acknowledgedAt'
> {}

import type { DateString, DecimalString, JsonValue, TimestampString } from './repositories';

export interface TenancyRecord {
  tenancyId: string; roomId: string; status: string; startedAt: TimestampString | null;
  endedAt: TimestampString | null; endReason: string | null;
}
export interface TenancyParticipantRecord {
  tenancyParticipantId: string; tenancyId: string; userId: string | null; role: string;
  joinedAt: TimestampString; leftAt: TimestampString | null;
}
export interface TenancyTermsRecord {
  tenancyTermsId: string; tenancyId: string; version: number; rentAmount: DecimalString;
  agreedDepositRequirement: DecimalString; termStart: DateString; termEnd: DateString;
  billingDayOrDueDateRule: JsonValue; electricityArrangement: JsonValue;
  waterArrangement: JsonValue; minimalRentalConditions: JsonValue;
  effectiveFromCycleBoundary: DateString;
}
export interface TermsAcknowledgementRecord {
  termsAcknowledgementId: string; tenancyTermsId: string; tenancyParticipantId: string;
  userId: string; acknowledgedAt: TimestampString;
}
export interface TenancyNoticeRecord {
  tenancyNoticeId: string; tenancyId: string; noticeType: string; issuedByUserId: string;
  contentOrNote: string; issuedAt: TimestampString; acknowledgedByUserId: string | null;
  acknowledgedAt: TimestampString | null;
}
export interface CreateTenancyInput extends TenancyRecord {}
export interface CreateTenancyParticipantInput extends TenancyParticipantRecord {}
export interface CreateTenancyTermsInput extends TenancyTermsRecord {}
export interface CreateTermsAcknowledgementInput extends TermsAcknowledgementRecord {}
export interface CreateTenancyNoticeInput extends TenancyNoticeRecord {}
export interface TenancyRepository {
  createTenancy(input: CreateTenancyInput): Promise<void>;
  findTenancy(tenancyId: string): Promise<TenancyRecord | undefined>;
  findNonterminalByRoom(roomId: string): Promise<TenancyRecord[]>;
  updateTenancy(record: TenancyRecord): Promise<void>;
  lockTenancy(tenancyId: string): Promise<void>;
  insertParticipant(input: CreateTenancyParticipantInput): Promise<void>;
  findParticipant(participantId: string): Promise<TenancyParticipantRecord | undefined>;
  findParticipantsByUser(userId: string): Promise<TenancyParticipantRecord[]>;
  findActivePrimary(tenancyId: string): Promise<TenancyParticipantRecord | undefined>;
  insertTerms(input: CreateTenancyTermsInput): Promise<void>;
  findTermsVersion(tenancyId: string, version: number): Promise<TenancyTermsRecord | undefined>;
  findTermsById(termsId: string): Promise<TenancyTermsRecord | undefined>;
  insertAcknowledgement(input: CreateTermsAcknowledgementInput): Promise<void>;
  insertNotice(input: CreateTenancyNoticeInput): Promise<void>;
}

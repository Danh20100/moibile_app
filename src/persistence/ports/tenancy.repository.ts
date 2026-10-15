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
export type CreateTenancyInput = TenancyRecord;
export type CreateTenancyParticipantInput = TenancyParticipantRecord;
export type CreateTenancyTermsInput = TenancyTermsRecord;
export type CreateTermsAcknowledgementInput = TermsAcknowledgementRecord;
export type CreateTenancyNoticeInput = TenancyNoticeRecord;
export interface TenancyRepository {
  createTenancy(input: CreateTenancyInput): Promise<void>;
  findTenancy(tenancyId: string): Promise<TenancyRecord | undefined>;
  findTenanciesByRoom(roomId?: string): Promise<TenancyRecord[]>;
  findNonterminalByRoom(roomId: string): Promise<TenancyRecord[]>;
  updateTenancy(record: TenancyRecord): Promise<void>;
  lockTenancy(tenancyId: string): Promise<void>;
  insertParticipant(input: CreateTenancyParticipantInput): Promise<void>;
  findParticipant(participantId: string): Promise<TenancyParticipantRecord | undefined>;
  findParticipantsByUser(userId: string): Promise<TenancyParticipantRecord[]>;
  findParticipantsByTenancy(tenancyId: string): Promise<TenancyParticipantRecord[]>;
  findActivePrimary(tenancyId: string): Promise<TenancyParticipantRecord | undefined>;
  updateParticipant(record: TenancyParticipantRecord): Promise<void>;
  insertTerms(input: CreateTenancyTermsInput): Promise<void>;
  findTermsVersion(tenancyId: string, version: number): Promise<TenancyTermsRecord | undefined>;
  findTermsById(termsId: string): Promise<TenancyTermsRecord | undefined>;
  findTermsByTenancy(tenancyId: string): Promise<TenancyTermsRecord[]>;
  insertAcknowledgement(input: CreateTermsAcknowledgementInput): Promise<void>;
  findAcknowledgementsByTerms(termsId: string): Promise<TermsAcknowledgementRecord[]>;
  insertNotice(input: CreateTenancyNoticeInput): Promise<void>;
  findNotice(noticeId: string): Promise<TenancyNoticeRecord | undefined>;
  findNoticesByTenancy(tenancyId: string): Promise<TenancyNoticeRecord[]>;
  updateNotice(record: TenancyNoticeRecord): Promise<void>;
}

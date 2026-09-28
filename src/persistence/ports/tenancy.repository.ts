import type { DateString, DecimalString, JsonValue, TimestampString } from './repositories';

export interface TenancyRecord {
  tenancy_id: string; room_id: string; status: string; started_at: TimestampString | null;
  ended_at: TimestampString | null; end_reason: string | null;
}
export interface TenancyParticipantRecord {
  tenancy_participant_id: string; tenancy_id: string; user_id: string | null; role: string;
  joined_at: TimestampString; left_at: TimestampString | null;
}
export interface TenancyTermsRecord {
  tenancy_terms_id: string; tenancy_id: string; version: number; rent_amount: DecimalString;
  agreed_deposit_requirement: DecimalString; term_start: DateString; term_end: DateString;
  billing_day_or_due_date_rule: JsonValue; electricity_arrangement: JsonValue;
  water_arrangement: JsonValue; minimal_rental_conditions: JsonValue;
  effective_from_cycle_boundary: DateString;
}
export interface TermsAcknowledgementRecord {
  terms_acknowledgement_id: string; tenancy_terms_id: string; tenancy_participant_id: string;
  user_id: string; acknowledged_at: TimestampString;
}
export interface TenancyNoticeRecord {
  tenancy_notice_id: string; tenancy_id: string; notice_type: string; issued_by_user_id: string;
  content_or_note: string; issued_at: TimestampString; acknowledged_by_user_id: string | null;
  acknowledged_at: TimestampString | null;
}
export interface CreateTenancyInput extends TenancyRecord {}
export interface CreateTenancyParticipantInput extends TenancyParticipantRecord {}
export interface CreateTenancyTermsInput extends TenancyTermsRecord {}
export interface CreateTermsAcknowledgementInput extends TermsAcknowledgementRecord {}
export interface CreateTenancyNoticeInput extends TenancyNoticeRecord {}
export interface TenancyRepository {
  createTenancy(input: CreateTenancyInput): Promise<void>;
  findTenancy(tenancyId: string): Promise<TenancyRecord | undefined>;
  findNonterminalTenanciesByRoom(roomId: string): Promise<TenancyRecord[]>;
  updateTenancy(record: TenancyRecord): Promise<void>;
  lockTenancy(tenancyId: string): Promise<void>;
  insertParticipant(input: CreateTenancyParticipantInput): Promise<void>;
  findParticipant(participantId: string): Promise<TenancyParticipantRecord | undefined>;
  findActiveParticipants(tenancyId: string): Promise<TenancyParticipantRecord[]>;
  insertTerms(input: CreateTenancyTermsInput): Promise<void>;
  findTerms(termsId: string): Promise<TenancyTermsRecord | undefined>;
  insertAcknowledgement(input: CreateTermsAcknowledgementInput): Promise<void>;
  insertNotice(input: CreateTenancyNoticeInput): Promise<void>;
}

import type { Kysely, Transaction } from 'kysely';

import type {
  CreateTenancyInput, CreateTenancyNoticeInput, CreateTenancyParticipantInput,
  CreateTenancyTermsInput, CreateTermsAcknowledgementInput, TenancyParticipantRecord,
  TenancyRecord, TenancyRepository, TenancyTermsRecord,
} from '../../../persistence/ports/tenancy.repository';
import { mapPostgresError } from '../postgres-error.mapper';
import type { Database } from '../schema.types';

export class PostgresTenancyRepository implements TenancyRepository {
  constructor(private readonly executor: Kysely<Database> | Transaction<Database>) {}

  async createTenancy(input: CreateTenancyInput): Promise<void> {
    try { await this.executor.insertInto('tenancies').values(this.tenancyValues(input)).execute(); }
    catch (error) { throw mapPostgresError(error); }
  }

  async findTenancy(tenancyId: string): Promise<TenancyRecord | undefined> {
    try {
      const row = await this.tenancySelect().where('tenancy_id', '=', tenancyId).executeTakeFirst();
      return row ? this.mapTenancy(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findTenanciesByRoom(roomId?: string): Promise<TenancyRecord[]> {
    try {
      let query = this.tenancySelect();
      if (roomId) query = query.where('room_id', '=', roomId);
      return (await query.orderBy('tenancy_id').execute()).map((row) => this.mapTenancy(row));
    } catch (error) { throw mapPostgresError(error); }
  }

  async findNonterminalByRoom(roomId: string): Promise<TenancyRecord[]> {
    try {
      const rows = await this.tenancySelect().where('room_id', '=', roomId)
        .where('status', 'in', ['DRAFT', 'ACTIVE', 'ENDING']).orderBy('tenancy_id').execute();
      return rows.map((row) => this.mapTenancy(row));
    } catch (error) { throw mapPostgresError(error); }
  }

  async updateTenancy(record: TenancyRecord): Promise<void> {
    try {
      const { tenancy_id: _, ...values } = this.tenancyValues(record);
      await this.executor.updateTable('tenancies').set(values).where('tenancy_id', '=', record.tenancyId).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async lockTenancy(tenancyId: string): Promise<void> {
    try { await this.executor.selectFrom('tenancies').select('tenancy_id').where('tenancy_id', '=', tenancyId).forUpdate().executeTakeFirst(); }
    catch (error) { throw mapPostgresError(error); }
  }

  async insertParticipant(input: CreateTenancyParticipantInput): Promise<void> {
    try {
      await this.executor.insertInto('tenancy_participants').values({
        tenancy_participant_id: input.tenancyParticipantId, tenancy_id: input.tenancyId,
        user_id: input.userId, role: input.role, joined_at: input.joinedAt, left_at: input.leftAt,
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findParticipant(participantId: string): Promise<TenancyParticipantRecord | undefined> {
    try {
      const row = await this.participantSelect().where('tenancy_participant_id', '=', participantId).executeTakeFirst();
      return row ? this.mapParticipant(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findParticipantsByUser(userId: string): Promise<TenancyParticipantRecord[]> {
    try {
      const rows = await this.participantSelect().where('user_id', '=', userId).orderBy('tenancy_participant_id').execute();
      return rows.map((row) => this.mapParticipant(row));
    } catch (error) { throw mapPostgresError(error); }
  }

  async findParticipantsByTenancy(tenancyId: string): Promise<TenancyParticipantRecord[]> {
    try {
      const rows = await this.participantSelect().where('tenancy_id', '=', tenancyId)
        .orderBy('tenancy_participant_id').execute();
      return rows.map((row) => this.mapParticipant(row));
    } catch (error) { throw mapPostgresError(error); }
  }

  async updateParticipant(record: TenancyParticipantRecord): Promise<void> {
    try {
      await this.executor.updateTable('tenancy_participants').set({
        user_id: record.userId, role: record.role, joined_at: record.joinedAt, left_at: record.leftAt,
      }).where('tenancy_participant_id', '=', record.tenancyParticipantId).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findActivePrimary(tenancyId: string): Promise<TenancyParticipantRecord | undefined> {
    try {
      const row = await this.participantSelect().where('tenancy_id', '=', tenancyId)
        .where('role', '=', 'PRIMARY').where('left_at', 'is', null).executeTakeFirst();
      return row ? this.mapParticipant(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async insertTerms(input: CreateTenancyTermsInput): Promise<void> {
    try {
      await this.executor.insertInto('tenancy_terms').values({
        tenancy_terms_id: input.tenancyTermsId, tenancy_id: input.tenancyId, version: input.version,
        rent_amount: input.rentAmount, agreed_deposit_requirement: input.agreedDepositRequirement,
        term_start: input.termStart, term_end: input.termEnd,
        billing_day_or_due_date_rule: JSON.stringify(input.billingDayOrDueDateRule),
        electricity_arrangement: JSON.stringify(input.electricityArrangement), water_arrangement: JSON.stringify(input.waterArrangement),
        minimal_rental_conditions: JSON.stringify(input.minimalRentalConditions),
        effective_from_cycle_boundary: input.effectiveFromCycleBoundary,
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findTermsVersion(tenancyId: string, version: number): Promise<TenancyTermsRecord | undefined> {
    try {
      const row = await this.termsSelect().where('tenancy_id', '=', tenancyId).where('version', '=', version).executeTakeFirst();
      return row ? this.mapTerms(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findTermsById(termsId: string): Promise<TenancyTermsRecord | undefined> {
    try {
      const row = await this.termsSelect().where('tenancy_terms_id', '=', termsId).executeTakeFirst();
      return row ? this.mapTerms(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findTermsByTenancy(tenancyId: string): Promise<TenancyTermsRecord[]> {
    try {
      const rows = await this.termsSelect().where('tenancy_id', '=', tenancyId).orderBy('version').execute();
      return rows.map((row) => this.mapTerms(row));
    } catch (error) { throw mapPostgresError(error); }
  }

  async insertAcknowledgement(input: CreateTermsAcknowledgementInput): Promise<void> {
    try {
      await this.executor.insertInto('terms_acknowledgements').values({
        terms_acknowledgement_id: input.termsAcknowledgementId, tenancy_terms_id: input.tenancyTermsId,
        tenancy_participant_id: input.tenancyParticipantId, user_id: input.userId,
        acknowledged_at: input.acknowledgedAt,
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findAcknowledgementsByTerms(termsId: string) {
    try {
      const rows = await this.executor.selectFrom('terms_acknowledgements').selectAll()
        .where('tenancy_terms_id', '=', termsId).orderBy('terms_acknowledgement_id').execute();
      return rows.map((row) => ({
        termsAcknowledgementId: row.terms_acknowledgement_id,
        tenancyTermsId: row.tenancy_terms_id,
        tenancyParticipantId: row.tenancy_participant_id,
        userId: row.user_id,
        acknowledgedAt: row.acknowledged_at,
      }));
    } catch (error) { throw mapPostgresError(error); }
  }

  async insertNotice(input: CreateTenancyNoticeInput): Promise<void> {
    try {
      await this.executor.insertInto('tenancy_notices').values({
        tenancy_notice_id: input.tenancyNoticeId, tenancy_id: input.tenancyId,
        notice_type: input.noticeType, issued_by_user_id: input.issuedByUserId,
        content_or_note: input.contentOrNote, issued_at: input.issuedAt,
        acknowledged_by_user_id: input.acknowledgedByUserId, acknowledged_at: input.acknowledgedAt,
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findNotice(noticeId: string) {
    try {
      const row = await this.noticeSelect().where('tenancy_notice_id', '=', noticeId).executeTakeFirst();
      return row ? this.mapNotice(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findNoticesByTenancy(tenancyId: string) {
    try {
      const rows = await this.noticeSelect().where('tenancy_id', '=', tenancyId)
        .orderBy('tenancy_notice_id').execute();
      return rows.map((row) => this.mapNotice(row));
    } catch (error) { throw mapPostgresError(error); }
  }

  async updateNotice(record: CreateTenancyNoticeInput): Promise<void> {
    try {
      await this.executor.updateTable('tenancy_notices').set({
        notice_type: record.noticeType, issued_by_user_id: record.issuedByUserId,
        content_or_note: record.contentOrNote, issued_at: record.issuedAt,
        acknowledged_by_user_id: record.acknowledgedByUserId, acknowledged_at: record.acknowledgedAt,
      }).where('tenancy_notice_id', '=', record.tenancyNoticeId).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  private tenancySelect() {
    return this.executor.selectFrom('tenancies').select(['tenancy_id', 'room_id', 'status', 'started_at', 'ended_at', 'end_reason']);
  }
  private participantSelect() {
    return this.executor.selectFrom('tenancy_participants').select(['tenancy_participant_id', 'tenancy_id', 'user_id', 'role', 'joined_at', 'left_at']);
  }
  private termsSelect() {
    return this.executor.selectFrom('tenancy_terms').select([
      'tenancy_terms_id', 'tenancy_id', 'version', 'rent_amount', 'agreed_deposit_requirement',
      'term_start', 'term_end', 'billing_day_or_due_date_rule', 'electricity_arrangement',
      'water_arrangement', 'minimal_rental_conditions', 'effective_from_cycle_boundary',
    ]);
  }
  private noticeSelect() {
    return this.executor.selectFrom('tenancy_notices').select([
      'tenancy_notice_id', 'tenancy_id', 'notice_type', 'issued_by_user_id', 'content_or_note',
      'issued_at', 'acknowledged_by_user_id', 'acknowledged_at',
    ]);
  }
  private tenancyValues(record: TenancyRecord) {
    return { tenancy_id: record.tenancyId, room_id: record.roomId, status: record.status, started_at: record.startedAt, ended_at: record.endedAt, end_reason: record.endReason };
  }
  private mapTenancy(row: { tenancy_id: string; room_id: string; status: string; started_at: string | null; ended_at: string | null; end_reason: string | null }): TenancyRecord {
    return { tenancyId: row.tenancy_id, roomId: row.room_id, status: row.status, startedAt: row.started_at, endedAt: row.ended_at, endReason: row.end_reason };
  }
  private mapParticipant(row: { tenancy_participant_id: string; tenancy_id: string; user_id: string | null; role: string; joined_at: string; left_at: string | null }): TenancyParticipantRecord {
    return { tenancyParticipantId: row.tenancy_participant_id, tenancyId: row.tenancy_id, userId: row.user_id, role: row.role, joinedAt: row.joined_at, leftAt: row.left_at };
  }
  private mapTerms(row: {
    tenancy_terms_id: string; tenancy_id: string; version: number; rent_amount: string;
    agreed_deposit_requirement: string; term_start: string; term_end: string;
    billing_day_or_due_date_rule: TenancyTermsRecord['billingDayOrDueDateRule'];
    electricity_arrangement: TenancyTermsRecord['electricityArrangement'];
    water_arrangement: TenancyTermsRecord['waterArrangement'];
    minimal_rental_conditions: TenancyTermsRecord['minimalRentalConditions'];
    effective_from_cycle_boundary: string;
  }): TenancyTermsRecord {
    return {
      tenancyTermsId: row.tenancy_terms_id, tenancyId: row.tenancy_id, version: row.version,
      rentAmount: row.rent_amount, agreedDepositRequirement: row.agreed_deposit_requirement,
      termStart: row.term_start, termEnd: row.term_end,
      billingDayOrDueDateRule: row.billing_day_or_due_date_rule,
      electricityArrangement: row.electricity_arrangement, waterArrangement: row.water_arrangement,
      minimalRentalConditions: row.minimal_rental_conditions,
      effectiveFromCycleBoundary: row.effective_from_cycle_boundary,
    };
  }
  private mapNotice(row: { tenancy_notice_id: string; tenancy_id: string; notice_type: string; issued_by_user_id: string; content_or_note: string; issued_at: string; acknowledged_by_user_id: string | null; acknowledged_at: string | null }) {
    return {
      tenancyNoticeId: row.tenancy_notice_id, tenancyId: row.tenancy_id, noticeType: row.notice_type,
      issuedByUserId: row.issued_by_user_id, contentOrNote: row.content_or_note, issuedAt: row.issued_at,
      acknowledgedByUserId: row.acknowledged_by_user_id, acknowledgedAt: row.acknowledged_at,
    };
  }
}

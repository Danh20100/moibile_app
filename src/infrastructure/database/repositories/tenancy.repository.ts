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
        billing_day_or_due_date_rule: input.billingDayOrDueDateRule,
        electricity_arrangement: input.electricityArrangement, water_arrangement: input.waterArrangement,
        minimal_rental_conditions: input.minimalRentalConditions,
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

  async insertAcknowledgement(input: CreateTermsAcknowledgementInput): Promise<void> {
    try {
      await this.executor.insertInto('terms_acknowledgements').values({
        terms_acknowledgement_id: input.termsAcknowledgementId, tenancy_terms_id: input.tenancyTermsId,
        tenancy_participant_id: input.tenancyParticipantId, user_id: input.userId,
        acknowledged_at: input.acknowledgedAt,
      }).execute();
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
}

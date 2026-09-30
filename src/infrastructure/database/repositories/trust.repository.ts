import { sql, type Kysely, type Transaction } from 'kysely';

import type { ReviewRecord, TrustReportRecord, TrustRepository } from '../../../persistence/ports/trust.repository';
import { mapPostgresError } from '../postgres-error.mapper';
import type { Database } from '../schema.types';

type Executor = Kysely<Database> | Transaction<Database>;

export class PostgresTrustRepository implements TrustRepository {
  constructor(private readonly db: Executor) {}

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) { throw mapPostgresError(error); }
  }

  private reviewValues(x: ReviewRecord) {
    return { review_id:x.reviewId, tenancy_id:x.tenancyId, property_id:x.propertyId, author_user_id:x.authorUserId, author_participant_id:x.authorParticipantId, overall_rating:x.overallRating, comment:x.comment, landlord_response:x.landlordResponse, landlord_response_by_user_id:x.landlordResponseByUserId, landlord_responded_at:x.landlordRespondedAt, created_at:x.createdAt };
  }
  async createReview(x: ReviewRecord): Promise<void> { await this.run(async()=>{ await this.db.insertInto('reviews').values(this.reviewValues(x)).execute(); }); }
  async updateReview(x: ReviewRecord): Promise<void> { const {review_id:_,...values}=this.reviewValues(x); await this.run(async()=>{ await this.db.updateTable('reviews').set(values).where('review_id','=',x.reviewId).execute(); }); }
  async findReview(id: string): Promise<ReviewRecord|undefined> { return this.run(async()=> (await sql<ReviewRecord>`SELECT review_id AS "reviewId",tenancy_id AS "tenancyId",property_id AS "propertyId",author_user_id AS "authorUserId",author_participant_id AS "authorParticipantId",overall_rating AS "overallRating",comment,landlord_response AS "landlordResponse",landlord_response_by_user_id AS "landlordResponseByUserId",landlord_responded_at AS "landlordRespondedAt",created_at AS "createdAt" FROM reviews WHERE review_id=${id}`.execute(this.db)).rows[0]); }

  private reportValues(x: TrustReportRecord) { return { trust_report_id:x.trustReportId, reporter_user_id:x.reporterUserId, listing_id:x.listingId, review_id:x.reviewId, reason:x.reason, status:x.status, note_or_evidence_reference:x.noteOrEvidenceReference, created_at:x.createdAt, resolved_at:x.resolvedAt }; }
  async createTrustReport(x: TrustReportRecord): Promise<void> { await this.run(async()=>{ await this.db.insertInto('trust_reports').values(this.reportValues(x)).execute(); }); }
  async updateTrustReport(x: TrustReportRecord): Promise<void> { const {trust_report_id:_,...values}=this.reportValues(x); await this.run(async()=>{ await this.db.updateTable('trust_reports').set(values).where('trust_report_id','=',x.trustReportId).execute(); }); }
  async findTrustReport(id: string): Promise<TrustReportRecord|undefined> { return this.run(async()=> (await sql<TrustReportRecord>`SELECT trust_report_id AS "trustReportId",reporter_user_id AS "reporterUserId",listing_id AS "listingId",review_id AS "reviewId",reason,status,note_or_evidence_reference AS "noteOrEvidenceReference",created_at AS "createdAt",resolved_at AS "resolvedAt" FROM trust_reports WHERE trust_report_id=${id}`.execute(this.db)).rows[0]); }
  async findTrustReports(): Promise<TrustReportRecord[]> { return this.run(async()=> [...(await sql<TrustReportRecord>`SELECT trust_report_id AS "trustReportId",reporter_user_id AS "reporterUserId",listing_id AS "listingId",review_id AS "reviewId",reason,status,note_or_evidence_reference AS "noteOrEvidenceReference",created_at AS "createdAt",resolved_at AS "resolvedAt" FROM trust_reports ORDER BY created_at,trust_report_id`.execute(this.db)).rows]); }
}

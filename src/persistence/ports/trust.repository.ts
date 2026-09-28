import type { TimestampString } from './repositories';

export interface ReviewRecord {
  review_id: string; tenancy_id: string; property_id: string; author_user_id: string;
  author_participant_id: string; overall_rating: number; comment: string;
  landlord_response: string | null; landlord_response_by_user_id: string | null;
  landlord_responded_at: TimestampString | null; created_at: TimestampString;
}
export interface TrustReportRecord {
  trust_report_id: string; reporter_user_id: string | null; listing_id: string | null;
  review_id: string | null; reason: string; status: string;
  note_or_evidence_reference: string | null; created_at: TimestampString;
  resolved_at: TimestampString | null;
}
export interface CreateReviewInput extends ReviewRecord {}
export interface CreateTrustReportInput extends TrustReportRecord {}
export interface TrustRepository {
  createReview(input: CreateReviewInput): Promise<void>;
  findReview(reviewId: string): Promise<ReviewRecord | undefined>;
  updateReview(record: ReviewRecord): Promise<void>;
  createTrustReport(input: CreateTrustReportInput): Promise<void>;
  findTrustReport(reportId: string): Promise<TrustReportRecord | undefined>;
  updateTrustReport(record: TrustReportRecord): Promise<void>;
}

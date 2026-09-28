import type { TimestampString } from './repositories';
export interface ReviewRecord { reviewId:string; tenancyId:string; propertyId:string; authorUserId:string; authorParticipantId:string; overallRating:number; comment:string; landlordResponse:string|null; landlordResponseByUserId:string|null; landlordRespondedAt:TimestampString|null; createdAt:TimestampString }
export interface TrustReportRecord { trustReportId:string; reporterUserId:string|null; listingId:string|null; reviewId:string|null; reason:string; status:string; noteOrEvidenceReference:string|null; createdAt:TimestampString; resolvedAt:TimestampString|null }
export interface TrustRepository {
  createReview(input:ReviewRecord):Promise<void>; findReview(id:string):Promise<ReviewRecord|undefined>; updateReview(input:ReviewRecord):Promise<void>;
  createTrustReport(input:TrustReportRecord):Promise<void>; findTrustReport(id:string):Promise<TrustReportRecord|undefined>; updateTrustReport(input:TrustReportRecord):Promise<void>;
}

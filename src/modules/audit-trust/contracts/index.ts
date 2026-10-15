export interface AuditRecord { id: string; actorId: string; action: string; resourceType: string; resourceId: string; metadata?: Record<string, unknown>; timestamp: string; }
export type TrustReportReason = 'INCORRECT_INFORMATION' | 'MISLEADING_PRICE' | 'WRONG_LOCATION' | 'DUPLICATE_LISTING' | 'INAPPROPRIATE_CONTENT' | 'SUSPECTED_FRAUD' | 'PRIVACY_VIOLATION' | 'SPAM' | 'OTHER';
export type TrustReportStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
export interface TrustReport { id: string; reporterUserId?: string; listingId?: string; reviewId?: string; reason: TrustReportReason; status: TrustReportStatus; noteOrEvidenceReference?: string; createdAt: string; resolvedAt?: string; }

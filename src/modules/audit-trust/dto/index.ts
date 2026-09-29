import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import type { TrustReportReason } from '../contracts';
export class RecordAuditFactDto { @IsString() @IsNotEmpty() actorId!: string; @IsString() @IsNotEmpty() action!: string; @IsString() @IsNotEmpty() resourceType!: string; @IsString() @IsNotEmpty() resourceId!: string; @IsOptional() @IsObject() metadata?: Record<string, unknown>; }
export class SubmitInternalReportDto { @IsOptional() @IsString() reporterUserId?: string; @IsOptional() @IsString() listingId?: string; @IsOptional() @IsString() reviewId?: string; @IsIn(['INCORRECT_INFORMATION', 'MISLEADING_PRICE', 'WRONG_LOCATION', 'DUPLICATE_LISTING', 'INAPPROPRIATE_CONTENT', 'SUSPECTED_FRAUD', 'PRIVACY_VIOLATION', 'SPAM', 'OTHER']) reason!: TrustReportReason; @IsOptional() @IsString() noteOrEvidenceReference?: string; }
export class QueryAuditDto { @IsOptional() @IsString() resourceType?: string; @IsOptional() @IsString() resourceId?: string; }

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import type { TrustReportReason, TrustReportStatus } from '../contracts';

export class RecordAuditFactDto {
  @ApiProperty({ example: 'user_12345' })
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @ApiProperty({ example: 'room.created' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({ example: 'room' })
  @IsString()
  @IsNotEmpty()
  resourceType!: string;

  @ApiProperty({ example: 'room_12345' })
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SubmitTrustReportDto {
  @ApiPropertyOptional({ example: 'list_12345' })
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiPropertyOptional({ example: 'rev_12345' })
  @IsOptional()
  @IsString()
  reviewId?: string;

  @ApiProperty({
    enum: [
      'INCORRECT_INFORMATION',
      'MISLEADING_PRICE',
      'WRONG_LOCATION',
      'DUPLICATE_LISTING',
      'INAPPROPRIATE_CONTENT',
      'SUSPECTED_FRAUD',
      'PRIVACY_VIOLATION',
      'SPAM',
      'OTHER',
    ],
  })
  @IsIn([
    'INCORRECT_INFORMATION',
    'MISLEADING_PRICE',
    'WRONG_LOCATION',
    'DUPLICATE_LISTING',
    'INAPPROPRIATE_CONTENT',
    'SUSPECTED_FRAUD',
    'PRIVACY_VIOLATION',
    'SPAM',
    'OTHER',
  ])
  reason!: TrustReportReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryAuditDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceId?: string;
}

export class AuditRecordDto {
  @ApiProperty({ example: 'audit_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'user_12345' })
  @IsString()
  actorId!: string;

  @ApiProperty({ example: 'room.created' })
  @IsString()
  action!: string;

  @ApiProperty({ example: 'room' })
  @IsString()
  resourceType!: string;

  @ApiProperty({ example: 'room_12345' })
  @IsString()
  resourceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  timestamp!: string;
}

export class TrustReportDto {
  @ApiProperty({ example: 'report_12345' })
  @IsString()
  id!: string;

  @ApiPropertyOptional({ example: 'user_12345' })
  @IsOptional()
  @IsString()
  reporterUserId?: string;

  @ApiPropertyOptional({ example: 'list_12345' })
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiPropertyOptional({ example: 'rev_12345' })
  @IsOptional()
  @IsString()
  reviewId?: string;

  @ApiProperty({
    enum: [
      'INCORRECT_INFORMATION',
      'MISLEADING_PRICE',
      'WRONG_LOCATION',
      'DUPLICATE_LISTING',
      'INAPPROPRIATE_CONTENT',
      'SUSPECTED_FRAUD',
      'PRIVACY_VIOLATION',
      'SPAM',
      'OTHER',
    ],
  })
  @IsString()
  reason!: TrustReportReason;

  @ApiProperty({
    enum: ['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'],
  })
  @IsString()
  status!: TrustReportStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noteOrEvidenceReference?: string;

  @ApiProperty()
  @IsString()
  createdAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolvedAt?: string;
}

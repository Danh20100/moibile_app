import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class AddTenancyParticipantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: string;

  @ApiProperty({ enum: ['PRIMARY', 'OCCUPANT'] })
  @IsIn(['PRIMARY', 'OCCUPANT'])
  role!: 'PRIMARY' | 'OCCUPANT';

  @ApiProperty()
  @IsDateString()
  joinedAt!: string;
}

export class ParticipantOccurredAtDto {
  @ApiProperty()
  @IsDateString()
  occurredAt!: string;
}

export class LinkParticipantUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class CreateTenancyTermsDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ example: '3500000.00' })
  @IsString()
  @Matches(MONEY)
  rentAmount!: string;

  @ApiProperty({ example: '3500000.00' })
  @IsString()
  @Matches(MONEY)
  agreedDepositRequirement!: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  @Matches(CALENDAR_DATE)
  termStart!: string;

  @ApiProperty({ example: '2027-09-30' })
  @IsString()
  @Matches(CALENDAR_DATE)
  termEnd!: string;

  @ApiProperty()
  @IsDefined()
  billingDayOrDueDateRule!: unknown;

  @ApiProperty()
  @IsDefined()
  electricityArrangement!: unknown;

  @ApiProperty()
  @IsDefined()
  waterArrangement!: unknown;

  @ApiProperty()
  @IsDefined()
  minimalRentalConditions!: unknown;

  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  @Matches(CALENDAR_DATE)
  effectiveFromCycleBoundary!: string;
}

export class CreateTermsAcknowledgementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenancyParticipantId!: string;

  @ApiProperty()
  @IsDateString()
  acknowledgedAt!: string;
}

export class IssueTenancyNoticeDto {
  @ApiProperty({ description: 'Opaque notice type; no Wave B enum is defined' })
  @IsString()
  @IsNotEmpty()
  noticeType!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contentOrNote!: string;

  @ApiProperty()
  @IsDateString()
  issuedAt!: string;
}

export class AcknowledgeTenancyNoticeDto {
  @ApiProperty()
  @IsDateString()
  occurredAt!: string;
}

export class TenancyProfileDto {
  @ApiProperty({ description: 'Tenancy ID', example: 'ten_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Room ID', example: 'room_12345' })
  @IsString()
  roomId!: string;

  @ApiProperty({
    description: 'Tenancy status',
    enum: ['draft', 'active', 'ending', 'ended', 'cancelled'],
    example: 'active',
  })
  @IsString()
  status!: 'draft' | 'active' | 'ending' | 'ended' | 'cancelled';

  @ApiPropertyOptional({ description: 'Start timestamp' })
  @IsOptional()
  @IsString()
  startedAt?: string;

  @ApiPropertyOptional({ description: 'End timestamp' })
  @IsOptional()
  @IsString()
  endedAt?: string;

  @ApiPropertyOptional({
    description: 'End reason',
    enum: ['TERM_ENDED', 'TENANT_INITIATED', 'OPERATOR_INITIATED', 'MUTUAL', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  endReason?: 'TERM_ENDED' | 'TENANT_INITIATED' | 'OPERATOR_INITIATED' | 'MUTUAL' | 'OTHER';
}

export class TenancyParticipantDto {
  @ApiProperty({ description: 'Participant ID', example: 'part_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Tenancy ID', example: 'ten_12345' })
  @IsString()
  tenancyId!: string;

  @ApiPropertyOptional({ description: 'Linked User ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ enum: ['PRIMARY', 'OCCUPANT'] })
  @IsString()
  role!: 'PRIMARY' | 'OCCUPANT';

  @ApiProperty()
  @IsString()
  joinedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leftAt?: string;
}

export class TenancyTermsDto {
  @ApiProperty({ description: 'Terms ID', example: 'terms_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Tenancy ID', example: 'ten_12345' })
  @IsString()
  tenancyId!: string;

  @ApiProperty()
  @IsInt()
  version!: number;

  @ApiProperty({ example: '3500000.00' })
  @IsString()
  rentAmount!: string;

  @ApiProperty({ example: '3500000.00' })
  @IsString()
  agreedDepositRequirement!: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  termStart!: string;

  @ApiProperty({ example: '2027-09-30' })
  @IsString()
  termEnd!: string;

  @ApiProperty()
  billingDayOrDueDateRule!: unknown;

  @ApiProperty()
  electricityArrangement!: unknown;

  @ApiProperty()
  waterArrangement!: unknown;

  @ApiProperty()
  minimalRentalConditions!: unknown;

  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  effectiveFromCycleBoundary!: string;
}

export class TermsAcknowledgementDto {
  @ApiProperty({ description: 'Acknowledgement ID', example: 'ack_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Terms ID', example: 'terms_12345' })
  @IsString()
  tenancyTermsId!: string;

  @ApiProperty({ description: 'Participant ID', example: 'part_12345' })
  @IsString()
  tenancyParticipantId!: string;

  @ApiProperty({ description: 'User ID', example: 'user_12345' })
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  acknowledgedAt!: string;
}

export class TenancyNoticeDto {
  @ApiProperty({ description: 'Notice ID', example: 'not_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Tenancy ID', example: 'ten_12345' })
  @IsString()
  tenancyId!: string;

  @ApiProperty()
  @IsString()
  noticeType!: string;

  @ApiProperty()
  @IsString()
  issuedByUserId!: string;

  @ApiProperty()
  @IsString()
  contentOrNote!: string;

  @ApiProperty()
  @IsString()
  issuedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acknowledgedByUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acknowledgedAt?: string;
}

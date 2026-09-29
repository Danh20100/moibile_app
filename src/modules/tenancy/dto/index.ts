import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
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
  @IsString()
  @IsNotEmpty()
  userId!: string;

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
  issuedByUserId!: string;

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
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;
}

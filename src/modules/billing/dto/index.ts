import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import type { ChargeType, DepositState, ManualPaymentSource, PaymentSource, PaymentVerification } from '../contracts';

const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export class CreateChargeDto {
  @ApiProperty({ enum: ['RENT', 'ELECTRICITY', 'WATER'], example: 'RENT' })
  @IsIn(['RENT', 'ELECTRICITY', 'WATER'])
  type!: ChargeType;

  @ApiProperty({ example: '3500000.00' })
  @Matches(MONEY)
  amount!: string;
}

export class CreateBillingCycleDto {
  @ApiProperty({ example: 'ten_12345' })
  @IsString()
  @IsNotEmpty()
  tenancyId!: string;

  @ApiProperty({ example: 'terms_12345' })
  @IsString()
  @IsNotEmpty()
  tenancyTermsId!: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2026-10-31' })
  @IsDateString()
  periodEnd!: string;

  @ApiProperty({ type: [CreateChargeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateChargeDto)
  charges!: CreateChargeDto[];
}

export class RecordPaymentDto {
  @ApiProperty({ example: 'ten_12345' })
  @IsString()
  @IsNotEmpty()
  tenancyId!: string;

  @ApiProperty({ example: '3500000.00' })
  @Matches(MONEY)
  amount!: string;

  @ApiProperty({ enum: ['MANUAL_CASH', 'MANUAL_TRANSFER'], example: 'MANUAL_TRANSFER' })
  @IsIn(['MANUAL_CASH', 'MANUAL_TRANSFER'])
  source!: ManualPaymentSource;

  @ApiProperty({ example: '2026-10-05T08:00:00.000Z' })
  @IsDateString()
  confirmedAt!: string;
}

export class CreateDepositDto {
  @ApiProperty({ example: 'ten_12345' })
  @IsString()
  @IsNotEmpty()
  tenancyId!: string;
}

export class SettleDepositDto {
  @ApiProperty({ example: '3000000.00' })
  @Matches(MONEY)
  refundedAmount!: string;

  @ApiProperty({ example: '500000.00' })
  @Matches(MONEY)
  retainedAmount!: string;

  @ApiProperty({ example: 'Final checkout settlement' })
  @IsString()
  @IsNotEmpty()
  reasonOrNote!: string;

  @ApiProperty({ example: '2026-10-05T08:00:00.000Z' })
  @IsDateString()
  settledAt!: string;
}

export class ApplyAmountDto {
  @ApiProperty({ example: '1000000.00' })
  @Matches(MONEY)
  amount!: string;

  @ApiProperty({ example: 'target_12345' })
  @IsString()
  @IsNotEmpty()
  targetId!: string;
}

export class ChargeDto {
  @ApiProperty({ example: 'chg_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'cycle_12345' })
  @IsString()
  billingCycleId!: string;

  @ApiProperty({ enum: ['RENT', 'ELECTRICITY', 'WATER'], example: 'RENT' })
  @IsString()
  type!: ChargeType;

  @ApiProperty({ example: '3500000.00' })
  @IsString()
  amount!: string;

  @ApiProperty({ example: '1500000.00', nullable: true })
  outstandingAmount!: string | null;
}

export class BillingCycleDto {
  @ApiProperty({ example: 'cycle_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'ten_12345' })
  @IsString()
  tenancyId!: string;

  @ApiProperty({ example: 'terms_12345' })
  @IsString()
  tenancyTermsId!: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  periodStart!: string;

  @ApiProperty({ example: '2026-10-31' })
  @IsString()
  periodEnd!: string;

  @ApiProperty({ nullable: true, example: '2026-10-31', description: 'Date-only due date from the applicable Terms and cycle start month; null for historical/unknown rules' })
  dueDate!: string | null;

  @ApiProperty({ type: [ChargeDto] })
  charges!: ChargeDto[];
}

export class PaymentDto {
  @ApiProperty({ example: 'pay_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'ten_12345' })
  @IsString()
  tenancyId!: string;

  @ApiProperty({ example: '3500000.00' })
  @IsString()
  amount!: string;

  @ApiProperty({ enum: ['MANUAL_CASH', 'MANUAL_TRANSFER', 'GATEWAY'] })
  @IsString()
  source!: PaymentSource;

  @ApiProperty({ enum: ['USER_RECORDED', 'PROVIDER_VERIFIED'] })
  @IsString()
  verification!: PaymentVerification;

  @ApiProperty()
  @IsString()
  confirmedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voidedOrReversedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctionNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replacementPaymentId?: string;
}

export class PaymentAllocationDto {
  @ApiProperty({ example: 'alloc_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'pay_12345' })
  @IsString()
  paymentId!: string;

  @ApiProperty({ example: 'chg_12345' })
  @IsString()
  chargeId!: string;

  @ApiProperty({ example: '3500000.00' })
  @IsString()
  allocatedAmount!: string;
}

export class DepositProjectionDto {
  @ApiProperty({ example: 'dep_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'ten_12345' })
  @IsString()
  tenancyId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '3500000.00' })
  requirementAmount!: string | null;

  @ApiProperty({ example: '2000000.00' })
  @IsString()
  fundedAmount!: string;

  @ApiProperty({ example: '0.00' })
  @IsString()
  settledAmount!: string;

  @ApiProperty({ example: '2000000.00' })
  @IsString()
  heldAmount!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: ['EXPECTED', 'PARTIALLY_HELD', 'HELD', 'PENDING_SETTLEMENT', 'SETTLED'],
  })
  state!: DepositState | null;

  @ApiProperty({
    description: 'True when an OPEN deposit-requirement-change policy prevents an authoritative state projection.',
  })
  blockedByOpenPolicy!: boolean;
}

export class DepositSettlementDto {
  @ApiProperty({ example: 'dset_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'dep_12345' })
  @IsString()
  depositId!: string;

  @ApiProperty({ example: '3000000.00' })
  @IsString()
  refundedAmount!: string;

  @ApiProperty({ example: '500000.00' })
  @IsString()
  retainedAmount!: string;

  @ApiProperty()
  @IsString()
  reasonOrNote!: string;

  @ApiProperty({ format: 'uuid' })
  @IsString()
  actedByUserId!: string;

  @ApiProperty()
  @IsString()
  settledAt!: string;
}

export class DepositEventDto {
  @ApiProperty({ example: 'devent_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'dep_12345' })
  @IsString()
  depositId!: string;

  @ApiProperty({ enum: ['RECEIVED', 'REFUNDED', 'RETAINED'] })
  @IsString()
  eventType!: string;

  @ApiProperty({ example: '1000000.00' })
  @IsString()
  amount!: string;

  @ApiProperty()
  @IsString()
  occurredAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  paymentApplicationId?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  settlementId?: string;
}

export class DepositPaymentApplicationDto {
  @ApiProperty({ example: 'dapp_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'pay_12345' })
  @IsString()
  paymentId!: string;

  @ApiProperty({ example: 'dep_12345' })
  @IsString()
  depositId!: string;

  @ApiProperty({ example: '3500000.00' })
  @IsString()
  appliedAmount!: string;

  @ApiProperty()
  @IsString()
  appliedAt!: string;
}

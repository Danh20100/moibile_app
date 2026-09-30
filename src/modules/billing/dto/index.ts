import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import type { ChargeType, PaymentSource, PaymentVerification } from '../contracts';

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

  @ApiProperty({ enum: ['MANUAL_CASH', 'MANUAL_TRANSFER', 'GATEWAY'], example: 'MANUAL_TRANSFER' })
  @IsIn(['MANUAL_CASH', 'MANUAL_TRANSFER', 'GATEWAY'])
  source!: PaymentSource;

  @ApiProperty({ enum: ['USER_RECORDED', 'PROVIDER_VERIFIED'], example: 'USER_RECORDED' })
  @IsIn(['USER_RECORDED', 'PROVIDER_VERIFIED'])
  verification!: PaymentVerification;

  @ApiProperty({ example: '2026-10-05T08:00:00.000Z' })
  @IsDateString()
  confirmedAt!: string;
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

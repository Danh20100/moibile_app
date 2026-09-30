import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNotEmpty, IsString, Matches, ValidateNested } from 'class-validator';
import type { ChargeType, PaymentSource, PaymentVerification } from '../contracts';

const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
export class CreateChargeDto { @IsIn(['RENT', 'ELECTRICITY', 'WATER']) type!: ChargeType; @Matches(MONEY) amount!: string; }
export class CreateBillingCycleDto {
  @IsString() @IsNotEmpty() tenancyId!: string;
  @IsString() @IsNotEmpty() tenancyTermsId!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateChargeDto) charges!: CreateChargeDto[];
}
export class RecordPaymentDto {
  @IsString() @IsNotEmpty() tenancyId!: string;
  @Matches(MONEY) amount!: string;
  @IsIn(['MANUAL_CASH', 'MANUAL_TRANSFER', 'GATEWAY']) source!: PaymentSource;
  @IsIn(['USER_RECORDED', 'PROVIDER_VERIFIED']) verification!: PaymentVerification;
  @IsDateString() confirmedAt!: string;
}
export class ApplyAmountDto { @ApiProperty() @Matches(MONEY) amount!: string; @ApiProperty() @IsString() @IsNotEmpty() targetId!: string; }

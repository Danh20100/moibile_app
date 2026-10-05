import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Matches } from 'class-validator';

const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export class CreateGatewayCheckoutDto {
  @ApiProperty({ example: '60000000-0000-4000-8000-000000000001' })
  @IsString()
  @IsNotEmpty()
  tenancyId!: string;

  @ApiProperty({ example: '4470000.00' })
  @Matches(MONEY)
  amount!: string;
}

export class GatewayCheckoutDto {
  @ApiProperty()
  replayAllowed!: boolean;

  @ApiPropertyOptional()
  replayBlockedReason?: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenancyId!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  referenceCode!: string;

  @ApiProperty({ enum: ['MOMO'] })
  provider!: 'MOMO';

  @ApiProperty({ enum: ['INITIATED', 'CREATED', 'UNKNOWN', 'FAILED', 'SUCCEEDED'] })
  status!: 'INITIATED' | 'CREATED' | 'UNKNOWN' | 'FAILED' | 'SUCCEEDED';

  @ApiPropertyOptional()
  payUrl?: string;

  @ApiPropertyOptional()
  deeplink?: string;

  @ApiPropertyOptional()
  resultingPaymentId?: string;

  @ApiProperty()
  createdAt!: string;
}

export class MomoIpnDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  partnerCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @ApiProperty()
  @IsString()
  orderInfo!: string;

  @ApiProperty()
  @IsString()
  orderType!: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty()
  @IsString()
  payType!: string;

  @ApiProperty()
  @IsString()
  extraData!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signature!: string;

  @ApiProperty()
  @IsInt()
  amount!: number;

  @ApiProperty()
  @IsInt()
  transId!: number;

  @ApiProperty()
  @IsInt()
  resultCode!: number;

  @ApiProperty()
  @IsInt()
  responseTime!: number;
}

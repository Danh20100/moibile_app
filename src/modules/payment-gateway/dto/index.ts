import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

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
  id!: string;

  @ApiProperty()
  tenancyId!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  referenceCode!: string;

  @ApiProperty({ enum: ['MOMO'] })
  provider!: 'MOMO';

  @ApiProperty({ enum: ['CREATED', 'FAILED', 'EXPIRED', 'SUCCEEDED'] })
  status!: 'CREATED' | 'FAILED' | 'EXPIRED' | 'SUCCEEDED';

  @ApiPropertyOptional()
  payUrl?: string;

  @ApiPropertyOptional()
  deeplink?: string;

  @ApiPropertyOptional()
  resultingPaymentId?: string;

  @ApiProperty()
  createdAt!: string;
}

export class MomoIpnResponseDto {
  @ApiProperty({ example: 0 })
  resultCode!: number;

  @ApiProperty({ example: 'success' })
  message!: string;
}

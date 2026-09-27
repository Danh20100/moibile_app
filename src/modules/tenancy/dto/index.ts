import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

import type { TenancyStatus } from '../contracts';

export class CreateTenancyDto {
  @ApiProperty({ description: 'ID phòng được thuê', example: 'room_12345' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiProperty({ description: 'ID người thuê (Tenant Identity)', example: 'tenant_12345' })
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty({ description: 'Giá thuê hàng tháng (VNĐ)', example: 3500000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monthlyRent!: number;

  @ApiProperty({ description: 'Tiền đặt cọc (VNĐ)', example: 3500000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount!: number;

  @ApiProperty({ description: 'Ngày hạn nộp tiền hàng tháng (1-31)', example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay!: number;

  @ApiProperty({ description: 'Ngày bắt đầu thuê (YYYY-MM-DD)', example: '2026-10-01' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc thuê dự kiến (YYYY-MM-DD)',
    example: '2027-10-01',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateTenancyStatusDto {
  @ApiProperty({
    description: 'Trạng thái kỳ thuê',
    enum: ['draft', 'active', 'ending', 'ended'],
    example: 'active',
  })
  @IsIn(['draft', 'active', 'ending', 'ended'])
  status!: TenancyStatus;
}

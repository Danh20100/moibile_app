import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OnboardingRoomItemDto {
  @ApiProperty({ description: 'Số phòng / Tên phòng', example: '101' })
  @IsString()
  @IsNotEmpty()
  roomNumber!: string;

  @ApiProperty({ description: 'Giá thuê hàng tháng (VNĐ)', example: 3200000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  basePrice!: number;

  @ApiPropertyOptional({ description: 'Diện tích (m2)', example: 22 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  area?: number;

  @ApiPropertyOptional({ description: 'Số người ở tối đa', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxOccupants?: number;
}

export class CreateOnboardingBatchDto {
  @ApiProperty({ description: 'ID của organization', example: 'org_12345' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Tên khu trọ mới', example: 'Khu trọ Thăng Long' })
  @IsString()
  @IsNotEmpty()
  propertyName!: string;

  @ApiProperty({ description: 'Địa chỉ khu trọ', example: 'Số 50 Trần Thái Tông, Cầu Giấy' })
  @IsString()
  @IsNotEmpty()
  propertyAddress!: string;

  @ApiProperty({
    description: 'Danh sách các phòng cần thiết lập nhanh',
    type: [OnboardingRoomItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OnboardingRoomItemDto)
  rooms!: OnboardingRoomItemDto[];
}

export class ConfirmOnboardingBatchDto {
  @ApiProperty({
    description: 'ID lô onboarding cần xác nhận để sinh dữ liệu thật',
    example: 'batch_12345',
  })
  @IsString()
  @IsNotEmpty()
  batchId!: string;
}

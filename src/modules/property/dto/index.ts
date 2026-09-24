import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import type { PropertyStatus } from '../contracts';

export class CreatePropertyDto {
  @ApiProperty({ description: 'ID của organization sở hữu tài sản', example: 'org_12345' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Tên khu trọ / tài sản', example: 'Nhà trọ 12 ngõ 80 Cầu Giấy' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Địa chỉ cụ thể', example: 'Số 12, Ngõ 80 Đường Cầu Giấy' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiPropertyOptional({ description: 'Phường / Xã', example: 'Dịch Vọng' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional({ description: 'Quận / Huyện', example: 'Cầu Giấy' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Tỉnh / Thành phố', example: 'Hà Nội' })
  @IsOptional()
  @IsString()
  city?: string;
}

export class UpdatePropertyDto {
  @ApiPropertyOptional({ description: 'Tên khu trọ', example: 'Nhà trọ Cầu Giấy Cơ sở 1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Phường / Xã' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional({ description: 'Quận / Huyện' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Tỉnh / Thành phố' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái tài sản',
    enum: ['active', 'archived'],
    example: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: PropertyStatus;
}

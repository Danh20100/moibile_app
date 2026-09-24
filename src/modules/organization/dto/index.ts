import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import type { OrganizationStatus } from '../contracts';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Tên tổ chức hoặc tên cơ sở kinh doanh',
    example: 'Hệ thống nhà trọ An Cư',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Mô tả thêm về tổ chức',
    example: 'Quản lý cụm 5 nhà trọ tại Cầu Giấy',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Tên tổ chức', example: 'Hệ thống phòng trọ An Cư Mới' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Mô tả thêm', example: 'Mô tả cập nhật' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động của tổ chức',
    enum: ['active', 'inactive', 'archived'],
    example: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'inactive', 'archived'])
  status?: OrganizationStatus;
}

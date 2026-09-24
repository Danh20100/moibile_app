import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

import type { ListingStatus } from '../contracts';

export class CreateListingDto {
  @ApiProperty({ description: 'ID phòng cần đăng tin', example: 'room_12345' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiProperty({ description: 'ID tài sản / khu trọ', example: 'prop_12345' })
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  @ApiProperty({
    description: 'Tiêu đề tin đăng công khai',
    example: 'Phòng khép kín ban công thoáng mát gần ĐH Quốc Gia',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Mô tả chi tiết phòng cho người thuê xem',
    example: 'Đầy đủ điều hòa, nóng lạnh, giờ giấc tự do không chung chủ',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Giá niêm yết công khai (VNĐ)', example: 3500000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiProperty({
    description: 'Tóm tắt vị trí địa lý',
    example: 'Ngõ 80 Cầu Giấy, Phường Dịch Vọng, Hà Nội',
  })
  @IsString()
  @IsNotEmpty()
  locationSummary!: string;
}

export class UpdateListingDto {
  @ApiPropertyOptional({ description: 'Tiêu đề tin đăng' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Mô tả tin đăng' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Giá niêm yết (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({ description: 'Tóm tắt vị trí' })
  @IsOptional()
  @IsString()
  locationSummary?: string;
}

export class UpdateListingStatusDto {
  @ApiProperty({
    description: 'Trạng thái bài đăng',
    enum: ['published', 'hidden', 'rented'],
    example: 'published',
  })
  @IsIn(['published', 'hidden', 'rented'])
  status!: ListingStatus;
}

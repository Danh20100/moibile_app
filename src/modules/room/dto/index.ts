import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

import type { RoomStatus } from '../contracts';

export class CreateRoomDto {
  @ApiProperty({ description: 'ID của Property chứa phòng', example: 'prop_12345' })
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  @ApiProperty({ description: 'Số phòng / Tên phòng', example: 'Phòng 201' })
  @IsString()
  @IsNotEmpty()
  roomNumber!: string;

  @ApiProperty({ description: 'Giá thuê cơ bản theo tháng (VNĐ)', example: 3500000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  basePrice!: number;

  @ApiPropertyOptional({ description: 'Diện tích phòng (m2)', example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  area?: number;

  @ApiPropertyOptional({ description: 'Số lượng người ở tối đa', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxOccupants?: number;
}

export class UpdateRoomDto {
  @ApiPropertyOptional({ description: 'Số phòng / Tên phòng', example: 'Phòng 201' })
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @ApiPropertyOptional({ description: 'Giá thuê cơ bản (VNĐ)', example: 3800000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  basePrice?: number;

  @ApiPropertyOptional({ description: 'Diện tích (m2)', example: 28 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  area?: number;

  @ApiPropertyOptional({ description: 'Số lượng người ở tối đa', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxOccupants?: number;
}

export class UpdateRoomStatusDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động của phòng',
    enum: ['draft', 'vacant', 'occupied', 'maintenance', 'archived'],
    example: 'vacant',
  })
  @IsIn(['draft', 'vacant', 'occupied', 'maintenance', 'archived'])
  status!: RoomStatus;
}

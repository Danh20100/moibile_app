import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateReceiptDto {
  @ApiProperty({ description: 'ID chu kỳ thu tiền cần đối soát', example: 'bill_12345' })
  @IsString()
  @IsNotEmpty()
  billingCycleId!: string;

  @ApiProperty({ description: 'ID kỳ thuê tương ứng', example: 'ten_12345' })
  @IsString()
  @IsNotEmpty()
  tenancyId!: string;

  @ApiProperty({ description: 'Số tiền thanh toán (VNĐ)', example: 3500000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({
    description: 'Phương thức thanh toán (bank_transfer, cash, ...)',
    example: 'bank_transfer',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @ApiProperty({
    description: 'Thời điểm thanh toán thực tế (ISO string)',
    example: '2026-10-04T10:30:00.000Z',
  })
  @IsDateString()
  paidAt!: string;

  @ApiPropertyOptional({
    description: 'Ghi chú thêm',
    example: 'Chuyển khoản qua ngân hàng kèm mã phòng 201',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmReceiptDto {
  @ApiProperty({
    description: 'ID người xác nhận (Chủ trọ hoặc Quản lý)',
    example: 'user_operator_123',
  })
  @IsString()
  @IsNotEmpty()
  confirmedBy!: string;

  @ApiPropertyOptional({
    description: 'Ghi chú xác nhận',
    example: 'Đã nhận đúng số tiền qua tài khoản Techcombank',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

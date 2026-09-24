import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class BillingChargeDto {
  @ApiProperty({
    description: 'Loại phí (rent, electricity, water, internet, ...)',
    example: 'rent',
  })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({
    description: 'Mô tả chi tiết khoản phí',
    example: 'Tiền thuê phòng tháng 10/2026',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Số tiền (VNĐ)', example: 3500000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class CreateBillingCycleDto {
  @ApiProperty({ description: 'ID kỳ thuê tương ứng', example: 'ten_12345' })
  @IsString()
  @IsNotEmpty()
  tenancyId!: string;

  @ApiProperty({ description: 'ID phòng', example: 'room_12345' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiProperty({ description: 'Tháng của kỳ thu (YYYY-MM)', example: '2026-10' })
  @IsString()
  @IsNotEmpty()
  cycleMonth!: string;

  @ApiProperty({ description: 'Hạn nộp tiền (YYYY-MM-DD)', example: '2026-10-05' })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ description: 'Danh sách các khoản phí trong kỳ', type: [BillingChargeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BillingChargeDto)
  charges!: BillingChargeDto[];
}

export class ApplyPaymentOutcomeDto {
  @ApiProperty({ description: 'Số tiền thanh toán được ghi nhận (VNĐ)', example: 3500000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amountPaid!: number;

  @ApiProperty({ description: 'ID biên nhận xác nhận thanh toán', example: 'rcpt_12345' })
  @IsString()
  @IsNotEmpty()
  receiptId!: string;
}

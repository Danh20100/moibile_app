import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class IssueReceiptDto {
  @ApiProperty({ description: 'Confirmed Payment ID' })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;
}

export class ReceiptRecordDto {
  @ApiProperty({ example: 'rcpt_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'pay_12345' })
  @IsString()
  paymentId!: string;

  @ApiProperty({ enum: ['ISSUED', 'VOIDED'], example: 'ISSUED' })
  @IsString()
  status!: 'ISSUED' | 'VOIDED';

  @ApiProperty()
  @IsString()
  issuedAt!: string;

  @ApiProperty({ required: false })
  voidedAt?: string;

  @ApiProperty({ required: false })
  replacementReceiptId?: string;
}

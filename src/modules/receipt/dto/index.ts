import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class IssueReceiptDto {
  @ApiProperty({ description: 'Confirmed Payment ID' })
  @IsString()
  @IsNotEmpty()
  paymentId!: string;
}

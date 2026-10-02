import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class TransitionRoomManuallyDto {
  @ApiProperty({ enum: ['vacant', 'maintenance', 'inactive'] })
  @IsIn(['vacant', 'maintenance', 'inactive'])
  operationalState!: 'vacant' | 'maintenance' | 'inactive';
}

export class CreateTenancyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roomId!: string;
}

export class ActivateTenancyDto {
  @ApiProperty({ description: 'Business-effective activation timestamp' })
  @IsDateString()
  occurredAt!: string;
}

export class CheckoutTenancyDto {
  @ApiProperty({ enum: ['TERM_ENDED', 'TENANT_INITIATED', 'OPERATOR_INITIATED', 'MUTUAL', 'OTHER'] })
  @IsIn(['TERM_ENDED', 'TENANT_INITIATED', 'OPERATOR_INITIATED', 'MUTUAL', 'OTHER'])
  endReason!: 'TERM_ENDED' | 'TENANT_INITIATED' | 'OPERATOR_INITIATED' | 'MUTUAL' | 'OTHER';

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;
}

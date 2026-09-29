import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ListingCommandContextDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reasonCode!: string;

  @ApiProperty({ description: 'Opaque actor type' })
  @IsString()
  @IsNotEmpty()
  actorType!: string;

  @ApiProperty({ description: 'Opaque command trigger' })
  @IsString()
  @IsNotEmpty()
  trigger!: string;
}

export class TransitionRoomManuallyDto extends ListingCommandContextDto {
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

export class ActivateTenancyDto extends ListingCommandContextDto {
  @ApiProperty()
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

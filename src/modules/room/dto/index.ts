import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ description: 'ID of parent Property', example: 'prop_12345' })
  @IsString()
  @IsNotEmpty()
  propertyId!: string;

  @ApiProperty({ description: 'Room name or label', example: 'Phong 201' })
  @IsString()
  @IsNotEmpty()
  nameOrLabel!: string;
}

export class UpdateRoomDto {
  @ApiPropertyOptional({ description: 'Room name or label', example: 'Phong 201' })
  @IsOptional()
  @IsString()
  nameOrLabel?: string;
}

export class UpdateRoomOperationalStateDto {
  @ApiProperty({
    description: 'Manual operational-state target (HTTP always uses cause=manual)',
    enum: ['vacant', 'maintenance', 'inactive'],
    example: 'maintenance',
  })
  @IsIn(['vacant', 'maintenance', 'inactive'])
  operationalState!: 'vacant' | 'maintenance' | 'inactive';
}

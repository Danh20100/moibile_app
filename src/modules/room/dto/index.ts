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
  @IsNotEmpty()
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

export class RoomProfileDto {
  @ApiProperty({ description: 'Room ID', example: 'room_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Parent Property ID', example: 'prop_12345' })
  @IsString()
  propertyId!: string;

  @ApiProperty({ description: 'Room name or label', example: 'Phong 201' })
  @IsString()
  nameOrLabel!: string;

  @ApiProperty({
    description: 'Operational state',
    enum: ['vacant', 'occupied', 'maintenance', 'inactive'],
    example: 'vacant',
  })
  @IsString()
  operationalState!: 'vacant' | 'occupied' | 'maintenance' | 'inactive';

  @ApiProperty({
    description: 'Record lifecycle',
    enum: ['active', 'archived'],
    example: 'active',
  })
  @IsString()
  recordLifecycle!: 'active' | 'archived';
}

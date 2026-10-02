import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { IncidentCategory, IncidentStatus } from '../contracts';

export class CreateIncidentDto {
  @ApiProperty({ description: 'Room ID', example: 'room_12345' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiPropertyOptional({ description: 'Reported by user ID' })
  @IsOptional()
  @IsString()
  reportedByUserId?: string;

  @ApiProperty({
    enum: ['ELECTRICAL', 'PLUMBING', 'ACCESS_SECURITY', 'ROOM_FACILITY', 'APPLIANCE', 'OTHER'],
    example: 'ELECTRICAL',
  })
  @IsIn(['ELECTRICAL', 'PLUMBING', 'ACCESS_SECURITY', 'ROOM_FACILITY', 'APPLIANCE', 'OTHER'])
  category!: IncidentCategory;
}

export class UpdateIncidentStatusDto {
  @ApiProperty({
    enum: ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'],
    example: 'IN_PROGRESS',
  })
  @IsIn(['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'])
  status!: IncidentStatus;

  @ApiPropertyOptional({ description: 'Actor user ID' })
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Closure reason' })
  @IsOptional()
  @IsString()
  closureReason?: string;
}

export class IncidentEventDto {
  @ApiProperty({ example: 'evt_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'inc_12345' })
  @IsString()
  incidentId!: string;

  @ApiProperty({ example: 'STATUS_CHANGED' })
  @IsString()
  eventType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentReference?: string;

  @ApiPropertyOptional({ enum: ['REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  fromStatus?: IncidentStatus;

  @ApiPropertyOptional({ enum: ['REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  toStatus?: IncidentStatus;

  @ApiProperty()
  @IsString()
  occurredAt!: string;
}

export class IncidentTicketDto {
  @ApiProperty({ example: 'inc_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'room_12345' })
  @IsString()
  roomId!: string;

  @ApiPropertyOptional({ description: 'Reported by user ID' })
  @IsOptional()
  @IsString()
  reportedByUserId?: string;

  @ApiProperty({
    enum: ['ELECTRICAL', 'PLUMBING', 'ACCESS_SECURITY', 'ROOM_FACILITY', 'APPLIANCE', 'OTHER'],
  })
  @IsString()
  category!: IncidentCategory;

  @ApiProperty({
    enum: ['REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'],
  })
  @IsString()
  status!: IncidentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closureReason?: string;

  @ApiProperty()
  @IsString()
  createdAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closedAt?: string;
}

import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { IncidentCategory, IncidentStatus } from '../contracts';
export class CreateIncidentDto { @IsString() @IsNotEmpty() roomId!: string; @IsOptional() @IsString() reportedByUserId?: string; @IsIn(['ELECTRICAL', 'PLUMBING', 'ACCESS_SECURITY', 'ROOM_FACILITY', 'APPLIANCE', 'OTHER']) category!: IncidentCategory; }
export class UpdateIncidentStatusDto { @IsIn(['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED']) status!: IncidentStatus; @IsOptional() @IsString() actorUserId?: string; @IsOptional() @IsString() note?: string; @IsOptional() @IsString() closureReason?: string; }

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const NUMERIC_18_SCALE_2 = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export class PublicLocationProjectionDto {
  @ApiProperty({ example: 10.77 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 106.69 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
export class CreateListingDto {
  @ApiPropertyOptional({ description: 'Client generated UUID for safe request retry' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Parent Room ID', example: 'room_12345' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiProperty({ description: 'Public listing title' })
  @IsString()
  @IsNotEmpty()
  publicTitle!: string;

  @ApiProperty({ description: 'Public listing description' })
  @IsString()
  @IsNotEmpty()
  publicDescription!: string;

  @ApiProperty({ description: 'Exact numeric(18,2)-compatible public price', example: '3500000.00' })
  @IsString()
  @Matches(NUMERIC_18_SCALE_2)
  publicPriceProjection!: string;

  @ApiProperty({ type: PublicLocationProjectionDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PublicLocationProjectionDto)
  publicLocationProjection!: PublicLocationProjectionDto;
}

export class UpdateListingDto {
  @ApiPropertyOptional({ description: 'Public listing title' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  publicTitle?: string;
  @ApiPropertyOptional({ description: 'Public listing description' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  publicDescription?: string;

  @ApiPropertyOptional({ description: 'Exact numeric(18,2)-compatible public price' })
  @IsOptional()
  @IsString()
  @Matches(NUMERIC_18_SCALE_2)
  publicPriceProjection?: string;

  @ApiPropertyOptional({ type: PublicLocationProjectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicLocationProjectionDto)
  publicLocationProjection?: PublicLocationProjectionDto;
}

export class CreateInquiryDto {
  @ApiProperty({ description: 'Listing ID' })
  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @ApiPropertyOptional({ description: 'Sender User ID when the sender has an account' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  senderUserId?: string;

  @ApiProperty({ description: 'Contact intent or message' })
  @IsString()
  @IsNotEmpty()
  contactIntentOrMessage!: string;

  @ApiProperty({ description: 'Opaque Inquiry status; no Wave B lifecycle is defined' })
  @IsString()
  @IsNotEmpty()
  status!: string;
}

export class ListingProfileDto {
  @ApiProperty({ description: 'Listing ID', example: 'list_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Room ID', example: 'room_12345' })
  @IsString()
  roomId!: string;

  @ApiProperty({
    description: 'Listing status',
    enum: ['draft', 'published', 'unpublished', 'archived'],
    example: 'published',
  })
  @IsString()
  status!: 'draft' | 'published' | 'unpublished' | 'archived';

  @ApiProperty({ description: 'Public title' })
  @IsString()
  publicTitle!: string;

  @ApiProperty({ description: 'Public description' })
  @IsString()
  publicDescription!: string;

  @ApiProperty({ description: 'Exact numeric(18,2)-compatible public price', example: '3500000.00' })
  @IsString()
  publicPriceProjection!: string;

  @ApiProperty({ description: 'Public location projection', type: PublicLocationProjectionDto })
  publicLocationProjection!: PublicLocationProjectionDto;
}

export class ListingStatusEventDto {
  @ApiProperty({ description: 'Listing status event ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Listing ID' })
  @IsString()
  listingId!: string;

  @ApiProperty({ enum: ['draft', 'published', 'unpublished', 'archived'] })
  @IsString()
  fromStatus!: 'draft' | 'published' | 'unpublished' | 'archived';

  @ApiProperty({ enum: ['draft', 'published', 'unpublished', 'archived'] })
  @IsString()
  toStatus!: 'draft' | 'published' | 'unpublished' | 'archived';

  @ApiProperty()
  @IsString()
  reasonCode!: string;

  @ApiProperty()
  @IsString()
  actorType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiProperty()
  @IsString()
  trigger!: string;

  @ApiProperty()
  @IsString()
  occurredAt!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class InquiryDto {
  @ApiProperty({ description: 'Inquiry ID', example: 'inq_12345' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Listing ID', example: 'list_12345' })
  @IsString()
  listingId!: string;

  @ApiPropertyOptional({ description: 'Sender user ID' })
  @IsOptional()
  @IsString()
  senderUserId?: string;

  @ApiProperty({ description: 'Contact intent or message' })
  @IsString()
  contactIntentOrMessage!: string;

  @ApiProperty({ description: 'Inquiry status' })
  @IsString()
  status!: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @IsString()
  createdAt!: string;
}

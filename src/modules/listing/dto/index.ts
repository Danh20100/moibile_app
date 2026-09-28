import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
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

export class ListingTransitionContextDto {
  @ApiProperty({ description: 'Transition reason code' })
  @IsString()
  @IsNotEmpty()
  reasonCode!: string;

  @ApiProperty({ description: 'Opaque actor type' })
  @IsString()
  @IsNotEmpty()
  actorType!: string;

  @ApiPropertyOptional({ description: 'Actor user ID when applicable' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  actorUserId?: string;

  @ApiProperty({ description: 'Opaque transition trigger' })
  @IsString()
  @IsNotEmpty()
  trigger!: string;

  @ApiPropertyOptional({ description: 'Optional transition metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
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

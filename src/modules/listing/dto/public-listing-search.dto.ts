import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

const NUMERIC_18_SCALE_2 = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export class PublicListingSearchQueryDto {
  @ApiProperty({ minimum: -90, maximum: 90, example: 10.776 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180, example: 106.7 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ minimum: 0, example: 5000, description: 'Radius in meters over public Listing projection coordinates' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusMeters!: number;

  @ApiPropertyOptional({ example: '2000000.00' })
  @IsOptional()
  @Matches(NUMERIC_18_SCALE_2)
  minPrice?: string;

  @ApiPropertyOptional({ example: '5000000.00' })
  @IsOptional()
  @Matches(NUMERIC_18_SCALE_2)
  maxPrice?: string;
}

export class PublicListingSearchResultDto {
  @ApiProperty()
  listingId!: string;

  @ApiProperty()
  roomId!: string;

  @ApiProperty()
  publicTitle!: string;

  @ApiProperty()
  publicDescription!: string;

  @ApiProperty({ example: '3500000.00' })
  publicPriceProjection!: string;

  @ApiProperty({ example: { latitude: 10.776, longitude: 106.7 } })
  publicLocation!: { latitude: number; longitude: number };

  @ApiProperty({ example: 842.5 })
  distanceMeters!: number;

  @ApiProperty({ type: [String] })
  publicPhotoIds?: string[];

  @ApiProperty({ type: [String] })
  publicAmenityIds?: string[];
}

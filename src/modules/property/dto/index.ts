import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GeoPointDto {
  @ApiProperty({ description: 'Latitude', example: 21.0285, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ description: 'Longitude', example: 105.8542, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class CreatePropertyDto {
  @ApiProperty({ description: 'ID of owning Organization workspace', example: 'org_12345' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Property / khu tro name', example: 'Nha tro 12 ngo 80 Cau Giay' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Operational address text',
    example: 'So 12, Ngo 80 Duong Cau Giay',
  })
  @IsString()
  @IsNotEmpty()
  operationalAddressText!: string;

  @ApiProperty({ description: 'Operational geospatial point', type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  operationalLocation!: GeoPointDto;

  @ApiProperty({ description: 'Public location projection', type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  publicLocationProjection!: GeoPointDto;
}

export class UpdatePropertyDto {
  @ApiPropertyOptional({ description: 'Property / khu tro name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'Operational address text' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  operationalAddressText?: string;

  @ApiPropertyOptional({ description: 'Operational geospatial point', type: GeoPointDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  operationalLocation?: GeoPointDto;

  @ApiPropertyOptional({ description: 'Public location projection', type: GeoPointDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  publicLocationProjection?: GeoPointDto;
}

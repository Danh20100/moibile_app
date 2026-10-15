import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Tên workspace vận hành cho thuê',
    example: 'Hệ thống nhà trọ An Cư',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'One-time proof bound to the current User, session and organization.create operation' })
  @IsString()
  @Length(40, 128)
  reauthProof!: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    description: 'Tên workspace vận hành cho thuê',
    example: 'Hệ thống phòng trọ An Cư Mới',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class OrganizationProfileDto {
  @ApiProperty({
    description: 'Organization ID',
    example: 'org_12345',
    type: String,
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Tên workspace',
    example: 'Hệ thống nhà trọ An Cư',
    type: String,
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'User ID của primary owner',
    example: 'user_12345',
    type: String,
  })
  @IsString()
  primaryOwnerUserId!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Tên workspace vận hành cho thuê',
    example: 'Hệ thống nhà trọ An Cư',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'User ID của primary owner (MVP ownership reference)',
    example: 'user_12345',
  })
  @IsString()
  @IsNotEmpty()
  primaryOwnerUserId!: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    description: 'Tên workspace vận hành cho thuê',
    example: 'Hệ thống phòng trọ An Cư Mới',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';

import type { UserRole } from '../contracts';

export class VerifyGoogleTokenDto {
  @ApiProperty({
    description: 'Google ID Token nhận từ Android Credential Manager',
    example: 'eyJhbGciOiJSUzI1Ni...',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class CreateInvitationDto {
  @ApiProperty({
    description: 'Email của người được mời (operator hoặc tenant)',
    example: 'tenant@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Vai trò được mời',
    enum: ['owner', 'operator', 'tenant', 'platform_admin'],
    example: 'tenant',
  })
  @IsIn(['owner', 'operator', 'tenant', 'platform_admin'])
  role!: UserRole;

  @ApiProperty({ description: 'ID tổ chức quản lý mời tham gia', example: 'org_12345' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'ID lời mời', example: 'inv_12345' })
  @IsString()
  @IsNotEmpty()
  invitationId!: string;
}

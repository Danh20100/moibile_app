import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyGoogleTokenDto {
  @ApiProperty({
    description: 'Google ID Token nhận từ Android Credential Manager',
    example: 'eyJhbGciOiJSUzI1Ni...',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

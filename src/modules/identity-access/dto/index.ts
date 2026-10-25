import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class AuthChallengeRequestDto {
  @ApiProperty({ enum: ['LOGIN', 'REGISTER'] })
  @IsIn(['LOGIN', 'REGISTER'])
  purpose!: 'LOGIN' | 'REGISTER';
}

export class GoogleSessionRequestDto {
  @ApiProperty({ description: 'Google ID token with the issued request nonce' })
  @IsString() @IsNotEmpty()
  idToken!: string;

  @ApiProperty({ description: 'One-time nonce returned by identity-access/auth/challenge' })
  @IsString() @IsNotEmpty()
  nonce!: string;
}

export class PasswordLoginDto {
  @ApiProperty({ description: 'Previously verified email address' })
  @IsString() @IsNotEmpty() @MaxLength(254)
  email!: string;

  @ApiProperty({ description: 'Password associated with an existing Argon2id credential' })
  @IsString() @IsNotEmpty() @MaxLength(1024)
  password!: string;
}

export class ReauthenticationProofDto extends GoogleSessionRequestDto {}
export class SecurityPinChangeDto {
  @ApiProperty() @IsString() @Matches(/^[0-9]{6}$/)
  currentPin!: string;
  @ApiProperty() @IsString() @Matches(/^[0-9]{6}$/)
  newPin!: string;
}
export class PasswordChangeDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1024)
  currentPassword!: string;
  @ApiProperty() @IsString() @Length(8, 1024)
  newPassword!: string;
}
export class SecurityPinSetupDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1024)
  password!: string;
  @ApiProperty() @IsString() @Matches(/^[0-9]{6}$/)
  pin!: string;
}
export class PinReauthenticationDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(256)
  nonce!: string;
  @ApiProperty() @IsString() @Matches(/^[0-9]{6}$/)
  pin!: string;
}
export class PasswordReauthenticationDto {
  @ApiProperty({ description: 'One-time challenge nonce for organization creation' })
  @IsString() @IsNotEmpty() @MaxLength(256)
  nonce!: string;

  @ApiProperty({ description: 'Existing verified account password' })
  @IsString() @IsNotEmpty() @MaxLength(1024)
  password!: string;
}
export class ReauthenticationChallengeDto { @ApiProperty() nonce!: string; @ApiProperty() expiresAt!: string }
export class ReauthenticationResponseDto { @ApiProperty() proof!: string; @ApiProperty() expiresAt!: string }

export class RefreshSessionRequestDto {
  @ApiProperty({ description: 'Opaque one-time refresh credential' })
  @IsString() @IsNotEmpty()
  refreshToken!: string;
}

export class IdentityChallengeDto {
  @ApiProperty({ enum: ['LOGIN', 'REGISTER'] })
  purpose!: 'LOGIN' | 'REGISTER';
  @ApiProperty() nonce!: string;
  @ApiProperty() expiresAt!: string;
}

export class IdentitySessionDto {
  @ApiProperty() userId!: string;
  @ApiProperty() sessionId!: string;
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: 'Bearer';
  @ApiProperty({ example: 900 }) expiresInSeconds!: 900;
  @ApiProperty() refreshExpiresAt!: string;
}

export class VerifyGoogleTokenDto {
  @ApiProperty({
    description: 'Google ID Token nhận từ Android Credential Manager',
    example: 'eyJhbGciOiJSUzI1Ni...',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class UserReferenceDto {
  @ApiProperty({
    description: 'User ID của người dùng',
    example: 'c22d8235-9d37-5d5f-bc4f-1f3bbd0b59a8',
  })
  @IsString()
  userId!: string;
}

export class VerifiedPrincipalDto {
  @ApiProperty({
    description: 'User ID của người dùng',
    example: 'c22d8235-9d37-5d5f-bc4f-1f3bbd0b59a8',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'Provider danh tính',
    example: 'google',
  })
  @IsString()
  provider!: 'google';

  @ApiProperty({
    description: 'Issuer của Google ID Token',
    example: 'https://accounts.google.com',
  })
  @IsString()
  issuer!: string;

  @ApiProperty({
    description: 'Google Subject ID (sub claim)',
    example: '112345678901234567890',
  })
  @IsString()
  subject!: string;

  @ApiPropertyOptional({
    description: 'Email người dùng',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái xác thực email',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Tên hiển thị người dùng',
    example: 'Nguyen Van A',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'URL ảnh đại diện',
  })
  @IsOptional()
  @IsString()
  pictureUrl?: string;
}

export class SessionContextDto {
  @ApiProperty({
    description: 'User ID của người dùng đã xác thực',
    example: 'c22d8235-9d37-5d5f-bc4f-1f3bbd0b59a8',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'Danh sách Organization ID mà user là primary owner',
    type: [String],
    example: ['org_123'],
  })
  @IsArray()
  operatedOrganizationIds!: string[];

  @ApiProperty({
    description: 'Danh sách Tenancy ID mà user tham gia',
    type: [String],
    example: ['ten_456'],
  })
  @IsArray()
  linkedTenancyIds!: string[];

  @ApiPropertyOptional({
    description: 'Email người dùng',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Tên hiển thị người dùng',
    example: 'Nguyen Van A',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'URL ảnh đại diện',
  })
  @IsOptional()
  @IsString()
  pictureUrl?: string;
}

/** Editable personal presentation, not a legal identity assertion. */
export class UpdateDisplayNameDto {
  @ApiProperty({ description: 'Editable public-facing display name; not the legal name', example: 'Nguyễn Văn A' })
  @IsString()
  @Length(1, 80)
  displayName!: string;
}

export class UploadProfileAvatarDto {
  @ApiProperty({ enum: ['image/jpeg', 'image/png'] })
  @IsString()
  @IsIn(['image/jpeg', 'image/png'])
  contentType!: 'image/jpeg' | 'image/png';

  @ApiProperty({ description: 'Base64 encoded JPEG/PNG, at most 2 MB decoded' })
  @IsString()
  @MaxLength(2796204)
  base64!: string;
}

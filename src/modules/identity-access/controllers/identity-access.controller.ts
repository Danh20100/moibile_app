import { Body, Controller, Get, Header, Headers, Inject, Optional, Param, Patch, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public } from '../../../common';
import type { SessionContext, UserReference, VerifiedPrincipal } from '../contracts';
import type { ProfileRecord } from '../../../persistence/ports/identity-foundation.repository';
import {
  SessionContextDto,
  UserReferenceDto,
  VerifiedPrincipalDto,
  UpdateDisplayNameDto,
  UploadProfileAvatarDto,
  AuthChallengeRequestDto,
  GoogleSessionRequestDto,
  RefreshSessionRequestDto,
  IdentityChallengeDto,
  IdentitySessionDto,
} from '../dto';
import { IdentityAccessService } from '../services/identity-access.service';
import { ProfileAvatarService } from '../services/profile-avatar.service';
import { IdentitySessionService } from '../services/identity-session.service';

@ApiTags('Identity & Access')
@Controller('identity-access')
export class IdentityAccessController {
  constructor(
    @Inject(IdentityAccessService)
    private readonly identityAccessService: IdentityAccessService,
    @Optional() @Inject(ProfileAvatarService)
    private readonly profileAvatarService?: ProfileAvatarService,
    @Optional() @Inject(IdentitySessionService)
    private readonly identitySessionService?: IdentitySessionService,
  ) {}

  @Public()
  @Post('auth/challenge')
  async issueAuthChallenge(@Body() dto: AuthChallengeRequestDto): Promise<IdentityChallengeDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.issueChallenge(dto.purpose);
  }

  @Public()
  @Post('auth/google')
  @ApiOperation({ summary: 'Xác thực người dùng qua Google ID Token (Android Credential Manager)' })
  @ApiResponse({
    status: 200,
    description: 'Xác thực thành công và trả về thông tin user profile',
    type: VerifiedPrincipalDto,
  })
  @ApiResponse({ status: 401, description: 'Token không hợp lệ hoặc đã hết hạn' })
  async authenticateWithGoogle(@Body() dto: GoogleSessionRequestDto): Promise<IdentitySessionDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.authenticateGoogle(dto);
  }

  @Public()
  @Post('register/google')
  async registerWithGoogle(@Body() dto: GoogleSessionRequestDto): Promise<IdentitySessionDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.registerGoogle(dto);
  }

  @Public()
  @Post('auth/refresh')
  async refreshSession(@Body() dto: RefreshSessionRequestDto): Promise<IdentitySessionDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.refresh(dto.refreshToken);
  }

  @Post('auth/logout')
  async logout(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer ') || !this.identitySessionService)
      throw new UnauthorizedException('Yêu cầu phiên đăng nhập');
    return this.identitySessionService.logout(authorization.substring(7).trim());
  }

  @Post('auth/revoke-all')
  async revokeAllSessions(@CurrentUser() user?: VerifiedPrincipal) {
    if (!user || !this.identitySessionService) throw new UnauthorizedException('Yêu cầu phiên đăng nhập');
    return this.identitySessionService.revokeAll(user.userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy session context của user hiện tại từ relationship thật' })
  @ApiResponse({ status: 200, description: 'Session context thành công', type: SessionContextDto })
  @ApiResponse({ status: 401, description: 'Chưa xác thực hoặc token không hợp lệ' })
  async getSessionContext(@CurrentUser() user?: VerifiedPrincipal): Promise<SessionContext> {
    if (!user) {
      throw new UnauthorizedException('Yêu cầu xác thực người dùng');
    }
    return this.identityAccessService.getSessionContext(user);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Read own persisted display-name Profile (authenticated)' })
  async getOwnProfile(@CurrentUser() user?: VerifiedPrincipal): Promise<ProfileRecord> {
    if (!user) throw new UnauthorizedException('Yêu cầu xác thực người dùng');
    return this.identityAccessService.getOwnProfile(user);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update only the authenticated User display name' })
  async updateOwnProfile(
    @CurrentUser() user: VerifiedPrincipal | undefined,
    @Body() dto: UpdateDisplayNameDto,
  ): Promise<ProfileRecord> {
    if (!user) throw new UnauthorizedException('Yêu cầu xác thực người dùng');
    return this.identityAccessService.updateOwnDisplayName(user, dto.displayName);
  }

  @Post('profile/avatar')
  @ApiOperation({ summary: 'Upload a private avatar for the authenticated User' })
  async uploadOwnAvatar(
    @CurrentUser() user: VerifiedPrincipal | undefined,
    @Body() dto: UploadProfileAvatarDto,
  ) {
    if (!user) throw new UnauthorizedException('Yêu cầu xác thực người dùng');
    if (!this.profileAvatarService) throw new ServiceUnavailableException('Profile avatar storage is unavailable');
    return this.profileAvatarService.upload(user.userId, dto);
  }

  @Get('profile/avatar')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Read the authenticated User private avatar' })
  async getOwnAvatar(@CurrentUser() user?: VerifiedPrincipal) {
    if (!user) throw new UnauthorizedException('Yêu cầu xác thực người dùng');
    if (!this.profileAvatarService) throw new ServiceUnavailableException('Profile avatar storage is unavailable');
    return this.profileAvatarService.content(user.userId);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Lấy thông tin digital identity profile theo ID' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Thông tin identity profile', type: UserReferenceDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy user' })
  async findUserById(@Param('id') id: string): Promise<UserReference> {
    return this.identityAccessService.findUserById(id);
  }
}

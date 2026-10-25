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
  PasswordLoginDto,
  RefreshSessionRequestDto,
  IdentityChallengeDto,
  IdentitySessionDto,
  ReauthenticationProofDto,
  PasswordReauthenticationDto,
  PinReauthenticationDto,
  SecurityPinSetupDto,
  SecurityPinChangeDto,
  PasswordChangeDto,
  ReauthenticationChallengeDto,
  ReauthenticationResponseDto,
} from '../dto';
import { IdentityAccessService } from '../services/identity-access.service';
import { ProfileAvatarService } from '../services/profile-avatar.service';
import { IdentitySessionService } from '../services/identity-session.service';
import { LocalDemoAuthService } from '../services/local-demo-auth.service';

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
    @Optional() @Inject(LocalDemoAuthService)
    private readonly localDemoAuth?: LocalDemoAuthService,
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
  @Post('auth/password')
  @ApiOperation({ summary: 'Sign in with a previously verified email and password' })
  @ApiResponse({ status: 200, type: IdentitySessionDto })
  @ApiResponse({ status: 401, description: 'Email or password is incorrect' })
  async authenticatePassword(@Body() dto: PasswordLoginDto): Promise<IdentitySessionDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.authenticatePassword(dto);
  }

  // For synthetic local development accounts only. Not an identity-verification endpoint.
  @Public()
  @Post('auth/local-demo')
  async authenticateLocalDemo(@Body() dto: { email?: string; password?: string }): Promise<IdentitySessionDto> {
    if (!this.localDemoAuth) throw new ServiceUnavailableException('Local demo login unavailable');
    return this.localDemoAuth.login(dto.email ?? '', dto.password ?? '');
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

  @Post('reauth/organization-create/challenge')
  async issueOrganizationCreateReauthChallenge(@CurrentUser() user?: VerifiedPrincipal): Promise<ReauthenticationChallengeDto> {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.issueOrganizationCreateReauthChallenge(user.userId, user.sessionId);
  }

  @Post('reauth/organization-create/proof')
  async completeOrganizationCreateReauth(
    @Body() dto: ReauthenticationProofDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ReauthenticationResponseDto> {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.completeOrganizationCreateReauth(dto, user.userId, user.sessionId);
  }

  @Post('reauth/organization-create/password')
  @ApiOperation({ summary: 'Confirm organization creation with the existing account password' })
  async completeOrganizationCreatePasswordReauth(
    @Body() dto: PasswordReauthenticationDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ReauthenticationResponseDto> {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.completeOrganizationCreatePasswordReauth(dto, user.userId, user.sessionId);
  }

  @Get('security/account')
  async getAccountSecurityStatus(@CurrentUser() user?: VerifiedPrincipal) {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.accountSecurityStatus(user.userId);
  }

  @Patch('security/password')
  async changePassword(
    @Body() dto: PasswordChangeDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ) {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.changeOwnPassword(dto, user.userId, user.sessionId);
  }

  @Patch('security/pin')
  async changeSecurityPin(
    @Body() dto: SecurityPinChangeDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ) {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.changeSecurityPin(dto, user.userId, user.sessionId);
  }

  @Get('security/pin')
  async getSecurityPinStatus(@CurrentUser() user?: VerifiedPrincipal): Promise<{ pinConfigured: boolean }> {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.securityPinStatus(user.userId);
  }

  @Post('security/pin')
  async configureSecurityPin(
    @Body() dto: SecurityPinSetupDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<{ pinConfigured: boolean }> {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.configureSecurityPin(dto, user.userId, user.sessionId);
  }

  @Post('reauth/organization-create/pin')
  async completeOrganizationCreatePinReauth(
    @Body() dto: PinReauthenticationDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ReauthenticationResponseDto> {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.completeOrganizationCreatePinReauth(dto, user.userId, user.sessionId);
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

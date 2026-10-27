import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Optional, Param, Patch, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public } from '../../../common';
import type { SessionContext, UserReference, VerifiedPrincipal } from '../contracts';
import type { ProfileRecord } from '../../../persistence/ports/identity-foundation.repository';
import {
  SessionContextDto,
  UserReferenceDto,
  VerifiedPrincipalDto,
  UpdateDisplayNameDto,
  UpdateProfileContactDto,
  UploadProfileAvatarDto,
  AuthChallengeRequestDto,
  GoogleSessionRequestDto,
  EmailOtpRequestDto,
  EmailOtpVerifyDto,
  EmailOtpChallengeDto,
  PasswordResetRequestDto,
  PasswordResetVerifyDto,
  PasswordResetAcceptedDto,
  EmailChangeRequestDto,
  EmailChangeVerifyDto,
  EmailChangeAcceptedDto,
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
  InitialPasswordSetupDto,
  ReauthenticationChallengeDto,
  ReauthenticationResponseDto,
} from '../dto';
import { IdentityAccessService } from '../services/identity-access.service';
import { ProfileAvatarService } from '../services/profile-avatar.service';
import { IdentitySessionService } from '../services/identity-session.service';
import { EmailOtpService } from '../services/email-otp.service';
import { EmailOtpRateLimit } from '../guards/email-otp-rate-limit.guard';

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
    @Optional() @Inject(EmailOtpService)
    private readonly emailOtpService?: EmailOtpService,
  ) {}

  @Public()
  @Post('auth/challenge')
  @ApiOperation({ summary: 'Issue a short-lived nonce for Google login or registration' })
  @ApiResponse({ status: 201, type: IdentityChallengeDto })
  async issueAuthChallenge(@Body() dto: AuthChallengeRequestDto): Promise<IdentityChallengeDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.issueChallenge(dto.purpose);
  }

  @Public()
  @Post('auth/google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate a Google account and create an application session' })
  @ApiResponse({ status: 200, description: 'Application session issued', type: IdentitySessionDto })
  @ApiResponse({ status: 401, description: 'Token không hợp lệ hoặc đã hết hạn' })
  async authenticateWithGoogle(@Body() dto: GoogleSessionRequestDto): Promise<IdentitySessionDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.authenticateGoogle(dto);
  }

  @Public()
  @Post('register/google')
  @ApiOperation({ summary: 'Register a Google-only account and create an application session' })
  @ApiResponse({ status: 201, type: IdentitySessionDto })
  async registerWithGoogle(@Body() dto: GoogleSessionRequestDto): Promise<IdentitySessionDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.registerGoogle(dto);
  }

  @Public()
  @Post('register/email/otp/request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @EmailOtpRateLimit('issue')
  @ApiOperation({ summary: 'Gửi mã OTP tới email để đăng ký tài khoản mật khẩu' })
  @ApiResponse({ status: 200, type: EmailOtpChallengeDto })
  async requestEmailRegistrationOtp(@Body() dto: EmailOtpRequestDto): Promise<EmailOtpChallengeDto> {
    if (!this.emailOtpService) throw new ServiceUnavailableException('Email registration is unavailable');
    return this.emailOtpService.request(dto);
  }

  @Public()
  @Post('register/email/otp/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @EmailOtpRateLimit('verify')
  @ApiOperation({ summary: 'Xác nhận mã OTP và tạo phiên đăng nhập' })
  @ApiResponse({ status: 200, type: IdentitySessionDto })
  async verifyEmailRegistrationOtp(@Body() dto: EmailOtpVerifyDto): Promise<IdentitySessionDto> {
    if (!this.emailOtpService) throw new ServiceUnavailableException('Email registration is unavailable');
    return this.emailOtpService.verify(dto);
  }

  @Public()
  @Post('auth/password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with a previously verified email and password' })
  @ApiResponse({ status: 200, type: IdentitySessionDto })
  @ApiResponse({ status: 401, description: 'Email or password is incorrect' })
  async authenticatePassword(@Body() dto: PasswordLoginDto): Promise<IdentitySessionDto> {
    if (!this.identitySessionService) throw new ServiceUnavailableException('Identity sessions are unavailable');
    return this.identitySessionService.authenticatePassword(dto);
  }

  @Public()
  @Post('password/reset/request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @EmailOtpRateLimit('issue')
  @ApiOperation({ summary: 'Gửi mã OTP đặt lại mật khẩu. Luôn trả 200 nếu email hợp lệ.' })
  @ApiResponse({ status: 200, type: EmailOtpChallengeDto })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<EmailOtpChallengeDto> {
    if (!this.emailOtpService) throw new ServiceUnavailableException('Email authentication is unavailable');
    return this.emailOtpService.requestPasswordReset(dto);
  }

  @Public()
  @Post('password/reset/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @EmailOtpRateLimit('verify')
  @ApiOperation({ summary: 'Xác nhận OTP, đổi mật khẩu và thu hồi mọi phiên' })
  @ApiResponse({ status: 200, type: PasswordResetAcceptedDto })
  async verifyPasswordReset(@Body() dto: PasswordResetVerifyDto): Promise<PasswordResetAcceptedDto> {
    if (!this.emailOtpService) throw new ServiceUnavailableException('Email authentication is unavailable');
    return this.emailOtpService.verifyPasswordReset(dto);
  }

  @Post('profile/email/otp/request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @EmailOtpRateLimit('issue')
  @ApiOperation({ summary: 'Gửi OTP xác minh email đăng nhập mới cho chính tài khoản hiện tại' })
  @ApiResponse({ status: 200, type: EmailOtpChallengeDto })
  async requestEmailChangeOtp(
    @Body() dto: EmailChangeRequestDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<EmailOtpChallengeDto> {
    if (!user?.sessionId || !this.emailOtpService) throw new UnauthorizedException('Application session is required');
    return this.emailOtpService.requestEmailChange(dto, user.userId, user.sessionId);
  }

  @Post('profile/email/otp/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @EmailOtpRateLimit('verify')
  @ApiOperation({ summary: 'Xác minh OTP và đổi email đăng nhập của chính tài khoản hiện tại' })
  @ApiResponse({ status: 200, description: 'Kết quả bước xác minh email hiện tại hoặc email mới', type: EmailChangeAcceptedDto })
  async verifyEmailChangeOtp(
    @Body() dto: EmailChangeVerifyDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ) {
    if (!user?.sessionId || !this.emailOtpService) throw new UnauthorizedException('Application session is required');
    return this.emailOtpService.verifyEmailChange(dto, user.userId, user.sessionId);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a one-time refresh credential and issue a new session token pair' })
  @ApiResponse({ status: 200, type: IdentitySessionDto })
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

  @Post('security/password/setup/challenge')
  async issueInitialPasswordSetupChallenge(@CurrentUser() user?: VerifiedPrincipal): Promise<ReauthenticationChallengeDto> {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.issueInitialPasswordSetupChallenge(user.userId, user.sessionId);
  }

  @Post('security/password/setup')
  async setInitialPassword(
    @Body() dto: InitialPasswordSetupDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<{ configured: boolean }> {
    if (!user?.sessionId || !this.identitySessionService) throw new UnauthorizedException('Application session is required');
    return this.identitySessionService.setInitialPassword(dto, user.userId, user.sessionId);
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

  @Get('profile/contact')
  async getOwnContact(@CurrentUser() user?: VerifiedPrincipal) {
    if (!user) throw new UnauthorizedException('Authentication required');
    return this.identityAccessService.getOwnContact(user);
  }

  @Patch('profile/contact')
  async updateOwnContact(@CurrentUser() user: VerifiedPrincipal | undefined, @Body() dto: UpdateProfileContactDto) {
    if (!user) throw new UnauthorizedException('Authentication required');
    return this.identityAccessService.updateOwnContact(user, dto);
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

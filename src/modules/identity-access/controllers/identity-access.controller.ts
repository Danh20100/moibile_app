import { Body, Controller, Get, Inject, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public } from '../../../common';
import type { SessionContext, UserReference, VerifiedPrincipal } from '../contracts';
import type { ProfileRecord } from '../../../persistence/ports/identity-foundation.repository';
import {
  SessionContextDto,
  UserReferenceDto,
  VerifiedPrincipalDto,
  VerifyGoogleTokenDto,
  UpdateDisplayNameDto,
} from '../dto';
import { IdentityAccessService } from '../services/identity-access.service';

@ApiTags('Identity & Access')
@Controller('identity-access')
export class IdentityAccessController {
  constructor(
    @Inject(IdentityAccessService)
    private readonly identityAccessService: IdentityAccessService,
  ) {}

  @Public()
  @Post('auth/google')
  @ApiOperation({ summary: 'Xác thực người dùng qua Google ID Token (Android Credential Manager)' })
  @ApiResponse({
    status: 200,
    description: 'Xác thực thành công và trả về thông tin user profile',
    type: VerifiedPrincipalDto,
  })
  @ApiResponse({ status: 401, description: 'Token không hợp lệ hoặc đã hết hạn' })
  async authenticateWithGoogle(@Body() dto: VerifyGoogleTokenDto): Promise<VerifiedPrincipal> {
    return this.identityAccessService.authenticateWithGoogle(dto);
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

  @Get('users/:id')
  @ApiOperation({ summary: 'Lấy thông tin digital identity profile theo ID' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Thông tin identity profile', type: UserReferenceDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy user' })
  async findUserById(@Param('id') id: string): Promise<UserReference> {
    return this.identityAccessService.findUserById(id);
  }
}

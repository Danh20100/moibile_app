import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Invitation, UserProfile } from '../contracts';
import { AcceptInvitationDto, CreateInvitationDto, VerifyGoogleTokenDto } from '../dto';
import { IdentityAccessService } from '../services/identity-access.service';

@ApiTags('Identity & Access')
@Controller('identity-access')
export class IdentityAccessController {
  constructor(private readonly identityAccessService: IdentityAccessService) {}

  @Post('auth/google')
  @ApiOperation({ summary: 'Xác thực người dùng qua Google ID Token (Android Credential Manager)' })
  @ApiResponse({ status: 200, description: 'Xác thực thành công và trả về thông tin user profile' })
  @ApiResponse({ status: 401, description: 'Token không hợp lệ hoặc đã hết hạn' })
  async authenticateWithGoogle(@Body() dto: VerifyGoogleTokenDto): Promise<UserProfile> {
    return this.identityAccessService.authenticateWithGoogle(dto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Lấy thông tin profile người dùng theo ID' })
  @ApiResponse({ status: 200, description: 'Thông tin profile' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy user' })
  async findUserById(@Param('id') id: string): Promise<UserProfile> {
    return this.identityAccessService.findUserById(id);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Tạo lời mời tham gia tổ chức dành cho Operator hoặc Tenant' })
  @ApiResponse({ status: 201, description: 'Lời mời đã được tạo thành công' })
  async createInvitation(@Body() dto: CreateInvitationDto): Promise<Invitation> {
    return this.identityAccessService.createInvitation(dto);
  }

  @Post('invitations/accept')
  @ApiOperation({ summary: 'Chấp nhận lời mời tham gia tổ chức' })
  @ApiResponse({ status: 200, description: 'Đã chấp nhận lời mời thành công' })
  @ApiResponse({ status: 400, description: 'Lời mời không hợp lệ hoặc đã hết hạn' })
  async acceptInvitation(@Body() dto: AcceptInvitationDto): Promise<Invitation> {
    return this.identityAccessService.acceptInvitation(dto.invitationId);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../common';
import { UserReference, VerifiedPrincipal } from '../contracts';
import { VerifyGoogleTokenDto } from '../dto';
import { IdentityAccessService } from '../services/identity-access.service';

@ApiTags('Identity & Access')
@Controller('identity-access')
export class IdentityAccessController {
  constructor(private readonly identityAccessService: IdentityAccessService) {}

  @Public()
  @Post('auth/google')
  @ApiOperation({ summary: 'Xác thực người dùng qua Google ID Token (Android Credential Manager)' })
  @ApiResponse({ status: 200, description: 'Xác thực thành công và trả về thông tin user profile' })
  @ApiResponse({ status: 401, description: 'Token không hợp lệ hoặc đã hết hạn' })
  async authenticateWithGoogle(@Body() dto: VerifyGoogleTokenDto): Promise<VerifiedPrincipal> {
    return this.identityAccessService.authenticateWithGoogle(dto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Lấy thông tin digital identity profile theo ID' })
  @ApiResponse({ status: 200, description: 'Thông tin identity profile' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy user' })
  async findUserById(@Param('id') id: string): Promise<UserReference> {
    return this.identityAccessService.findUserById(id);
  }
}

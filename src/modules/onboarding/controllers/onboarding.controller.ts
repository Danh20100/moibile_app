import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import { OnboardingBatch } from '../contracts';
import { ConfirmOnboardingBatchDto, CreateOnboardingBatchDto } from '../dto';
import { OnboardingService } from '../services/onboarding.service';

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(
    @Inject(OnboardingService)
    private readonly onboardingService: OnboardingService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post('preview')
  @ApiOperation({
    summary:
      'Tải lên danh sách tài sản/phòng trọ để kiểm tra tính hợp lệ và xem trước (Preview) trước khi xác nhận',
  })
  @ApiResponse({ status: 201, description: 'Đã validate dữ liệu thành công và sinh bản xem trước' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc trùng lặp số phòng' })
  async validateAndPreview(
    @Body() dto: CreateOnboardingBatchDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<OnboardingBatch> {
    if (user) {
      await this.authz.assertOperatesOrganization(user.userId, dto.organizationId);
    }
    return this.onboardingService.validateAndPreview(dto);
  }

  @Post('confirm')
  @ApiOperation({
    summary: 'Xác nhận tạo dữ liệu thực tế (property, rooms) từ lô xem trước',
  })
  @ApiResponse({ status: 200, description: 'Xác nhận thành công và đã tạo dữ liệu vào hệ thống' })
  @ApiResponse({ status: 400, description: 'Lô dữ liệu đã được xác nhận trước đó' })
  async confirmBatch(
    @Body() dto: ConfirmOnboardingBatchDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<OnboardingBatch> {
    if (user) {
      await this.authz.assertOperatesOrganization(user.userId, dto.organizationId);
    }
    return this.onboardingService.confirmBatch(dto);
  }
}

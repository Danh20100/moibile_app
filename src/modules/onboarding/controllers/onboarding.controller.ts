import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { OnboardingBatch } from '../contracts';
import { ConfirmOnboardingBatchDto, CreateOnboardingBatchDto } from '../dto';
import { OnboardingService } from '../services/onboarding.service';

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('preview')
  @ApiOperation({
    summary:
      'Tải lên danh sách tài sản/phòng trọ để kiểm tra tính hợp lệ và xem trước (Preview) trước khi xác nhận',
  })
  @ApiResponse({ status: 201, description: 'Đã validate dữ liệu thành công và sinh bản xem trước' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc trùng lặp số phòng' })
  async validateAndPreview(@Body() dto: CreateOnboardingBatchDto): Promise<OnboardingBatch> {
    return this.onboardingService.validateAndPreview(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết lô dữ liệu onboarding theo ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết lô dữ liệu' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lô onboarding' })
  async findById(@Param('id') id: string): Promise<OnboardingBatch> {
    return this.onboardingService.findById(id);
  }

  @Post('confirm')
  @ApiOperation({
    summary: 'Xác nhận tạo dữ liệu thực tế (property, rooms) từ lô xem trước',
  })
  @ApiResponse({ status: 200, description: 'Xác nhận thành công và đã tạo dữ liệu vào hệ thống' })
  @ApiResponse({ status: 400, description: 'Lô dữ liệu đã được xác nhận trước đó' })
  async confirmBatch(@Body() dto: ConfirmOnboardingBatchDto): Promise<OnboardingBatch> {
    return this.onboardingService.confirmBatch(dto);
  }
}

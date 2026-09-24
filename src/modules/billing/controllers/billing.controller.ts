import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { BillingCycle } from '../contracts';
import { ApplyPaymentOutcomeDto, CreateBillingCycleDto } from '../dto';
import { BillingService } from '../services/billing.service';

@ApiTags('Billing')
@Controller('billings')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('cycles')
  @ApiOperation({ summary: 'Tạo chu kỳ thu tiền mới (billing cycle) cho kỳ thuê' })
  @ApiResponse({ status: 201, description: 'Chu kỳ thu tiền đã được tạo thành công' })
  async createCycle(@Body() dto: CreateBillingCycleDto): Promise<BillingCycle> {
    return this.billingService.createCycle(dto);
  }

  @Get('cycles')
  @ApiOperation({ summary: 'Lấy danh sách các chu kỳ thu tiền (có thể lọc theo tenancyId)' })
  @ApiQuery({ name: 'tenancyId', required: false, description: 'Lọc theo Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Danh sách chu kỳ thu tiền' })
  async findByTenancyId(@Query('tenancyId') tenancyId?: string): Promise<BillingCycle[]> {
    return this.billingService.findByTenancyId(tenancyId);
  }

  @Get('cycles/:id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một chu kỳ thu tiền' })
  @ApiResponse({ status: 200, description: 'Thông tin chu kỳ thu tiền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chu kỳ thu tiền' })
  async findById(@Param('id') id: string): Promise<BillingCycle> {
    return this.billingService.findById(id);
  }

  @Post('cycles/:id/payment-outcome')
  @ApiOperation({ summary: 'Cập nhật đối soát thanh toán từ receipt sang billing cycle' })
  @ApiResponse({ status: 200, description: 'Cập nhật công nợ thành công' })
  @ApiResponse({ status: 400, description: 'Yêu cầu không hợp lệ hoặc đã thanh toán đủ' })
  async applyPaymentOutcome(
    @Param('id') id: string,
    @Body() dto: ApplyPaymentOutcomeDto,
  ): Promise<BillingCycle> {
    return this.billingService.applyPaymentOutcome(id, dto);
  }
}

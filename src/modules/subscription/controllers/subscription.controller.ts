import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { EntitlementDecision, OrganizationSubscription } from '../contracts';
import { AssignSubscriptionDto, CheckEntitlementQueryDto } from '../dto';
import { SubscriptionService } from '../services/subscription.service';

@ApiTags('Subscription')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('assign')
  @ApiOperation({ summary: 'Kích hoạt hoặc gia hạn gói dịch vụ cho tổ chức' })
  @ApiResponse({ status: 200, description: 'Gói dịch vụ đã được cập nhật' })
  async assignPlan(@Body() dto: AssignSubscriptionDto): Promise<OrganizationSubscription> {
    return this.subscriptionService.assignPlan(dto);
  }

  @Get('organizations/:organizationId')
  @ApiOperation({ summary: 'Lấy thông tin gói dịch vụ hiện tại của tổ chức' })
  @ApiResponse({ status: 200, description: 'Thông tin gói dịch vụ' })
  async getSubscription(
    @Param('organizationId') organizationId: string,
  ): Promise<OrganizationSubscription> {
    return this.subscriptionService.getSubscription(organizationId);
  }

  @Get('check-entitlement')
  @ApiOperation({
    summary: 'Kiểm tra quyền hạn sử dụng một tính năng theo gói sản phẩm (Entitlement)',
  })
  @ApiResponse({ status: 200, description: 'Quyết định cấp phép tính năng' })
  async checkEntitlement(@Query() query: CheckEntitlementQueryDto): Promise<EntitlementDecision> {
    return this.subscriptionService.checkEntitlement(query.organizationId, query.capability);
  }
}

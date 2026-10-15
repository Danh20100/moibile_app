import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import { EntitlementDecision, OrganizationSubscription } from '../contracts';
import { AssignSubscriptionDto, CheckEntitlementQueryDto } from '../dto';
import { SubscriptionService } from '../services/subscription.service';

@ApiTags('Subscription')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    @Inject(SubscriptionService)
    private readonly subscriptionService: SubscriptionService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post('assign')
  @ApiOperation({ summary: 'Kích hoạt hoặc gia hạn gói dịch vụ cho tổ chức' })
  @ApiResponse({ status: 200, description: 'Gói dịch vụ đã được cập nhật' })
  async assignPlan(
    @Body() dto: AssignSubscriptionDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<OrganizationSubscription> {
    if (user) {
      await this.authz.assertOperatesOrganization(user.userId, dto.organizationId);
    }
    return this.subscriptionService.assignPlan(dto);
  }

  @Get('organizations/:organizationId')
  @ApiOperation({ summary: 'Lấy thông tin gói dịch vụ hiện tại của tổ chức' })
  @ApiResponse({ status: 200, description: 'Thông tin gói dịch vụ' })
  async getSubscription(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<OrganizationSubscription> {
    if (user) {
      await this.authz.assertOperatesOrganization(user.userId, organizationId);
    }
    return this.subscriptionService.getSubscription(organizationId);
  }

  @Get('check-entitlement')
  @ApiOperation({
    summary: 'Kiểm tra quyền hạn sử dụng một tính năng theo gói sản phẩm (Entitlement)',
  })
  @ApiResponse({ status: 200, description: 'Quyết định cấp phép tính năng' })
  async checkEntitlement(
    @Query() query: CheckEntitlementQueryDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<EntitlementDecision> {
    if (user) {
      await this.authz.assertOperatesOrganization(user.userId, query.organizationId);
    }
    return this.subscriptionService.checkEntitlement(query.organizationId, query.capability);
  }
}

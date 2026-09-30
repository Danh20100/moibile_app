import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type {
  BillingCycle,
  DepositPaymentApplication,
  Payment,
  PaymentAllocation,
} from '../contracts';
import {
  ApplyAmountDto,
  BillingCycleDto,
  CreateBillingCycleDto,
  DepositPaymentApplicationDto,
  PaymentAllocationDto,
  PaymentDto,
  RecordPaymentDto,
} from '../dto';
import { BillingService } from '../services/billing.service';

@ApiTags('Finance')
@Controller('finance')
export class BillingController {
  constructor(
    @Inject(BillingService)
    private readonly billingService: BillingService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post('cycles')
  @ApiOperation({ summary: 'Create a billing cycle' })
  @ApiResponse({ status: 201, description: 'Billing cycle created', type: BillingCycleDto })
  async createCycle(
    @Body() dto: CreateBillingCycleDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<BillingCycle> {
    if (user) {
      await this.authz.assertOperatesTenancy(user.userId, dto.tenancyId);
    }
    return this.billingService.createCycle(dto);
  }

  @Get('cycles')
  @ApiOperation({ summary: 'Find billing cycles by tenancy ID' })
  @ApiQuery({ name: 'tenancyId', type: String, required: false })
  @ApiResponse({ status: 200, description: 'List of billing cycles', type: [BillingCycleDto] })
  async findCycles(
    @Query('tenancyId') tenancyId?: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<BillingCycle[]> {
    if (tenancyId) {
      if (user) {
        await this.authz.assertCanAccessTenancy(user.userId, tenancyId);
      }
      return this.billingService.findByTenancyId(tenancyId);
    }
    if (user) {
      const all = await this.billingService.findByTenancyId();
      const accessible = await Promise.all(
        all.map(async (c) => {
          try {
            await this.authz.assertCanAccessTenancy(user.userId, c.tenancyId);
            return c;
          } catch {
            return null;
          }
        }),
      );
      return accessible.filter((c): c is BillingCycle => c !== null);
    }
    return this.billingService.findByTenancyId();
  }

  @Get('cycles/:id')
  @ApiOperation({ summary: 'Get billing cycle by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Billing cycle details', type: BillingCycleDto })
  async findCycle(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<BillingCycle> {
    if (user) {
      await this.authz.assertCanAccessBillingCycle(user.userId, id);
    }
    return this.billingService.findById(id);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record a payment' })
  @ApiResponse({ status: 201, description: 'Payment recorded', type: PaymentDto })
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<Payment> {
    if (user) {
      await this.authz.assertCanAccessTenancy(user.userId, dto.tenancyId);
    }
    return this.billingService.recordPayment(dto);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Payment details', type: PaymentDto })
  async findPayment(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<Payment> {
    if (user) {
      await this.authz.assertCanAccessPayment(user.userId, id);
    }
    return this.billingService.findPaymentById(id);
  }

  @Post('payments/:id/allocations')
  @ApiOperation({ summary: 'Allocate payment to charge' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Payment allocated', type: PaymentAllocationDto })
  async allocate(
    @Param('id') id: string,
    @Body() dto: ApplyAmountDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<PaymentAllocation> {
    if (user) {
      const payment = await this.authz.assertCanAccessPayment(user.userId, id);
      await this.authz.assertOperatesTenancy(user.userId, payment.tenancyId);
    }
    return this.billingService.allocatePayment(id, dto.targetId, dto.amount);
  }

  @Post('payments/:id/deposit-applications')
  @ApiOperation({ summary: 'Apply payment to deposit' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 201,
    description: 'Deposit application created',
    type: DepositPaymentApplicationDto,
  })
  async applyDeposit(
    @Param('id') id: string,
    @Body() dto: ApplyAmountDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<DepositPaymentApplication> {
    if (user) {
      const payment = await this.authz.assertCanAccessPayment(user.userId, id);
      await this.authz.assertOperatesTenancy(user.userId, payment.tenancyId);
    }
    return this.billingService.applyPaymentToDeposit(id, dto.targetId, dto.amount);
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { BillingCycle, DepositPaymentApplication, Payment, PaymentAllocation } from '../contracts';
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
  constructor(private readonly billingService: BillingService) {}

  @Post('cycles')
  @ApiOperation({ summary: 'Create a billing cycle' })
  @ApiResponse({ status: 201, description: 'Billing cycle created', type: BillingCycleDto })
  async createCycle(@Body() dto: CreateBillingCycleDto): Promise<BillingCycle> {
    return this.billingService.createCycle(dto);
  }

  @Get('cycles')
  @ApiOperation({ summary: 'Find billing cycles by tenancy ID' })
  @ApiQuery({ name: 'tenancyId', type: String, required: false })
  @ApiResponse({ status: 200, description: 'List of billing cycles', type: [BillingCycleDto] })
  async findCycles(@Query('tenancyId') tenancyId?: string): Promise<BillingCycle[]> {
    return this.billingService.findByTenancyId(tenancyId);
  }

  @Get('cycles/:id')
  @ApiOperation({ summary: 'Get billing cycle by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Billing cycle details', type: BillingCycleDto })
  async findCycle(@Param('id') id: string): Promise<BillingCycle> {
    return this.billingService.findById(id);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record a payment' })
  @ApiResponse({ status: 201, description: 'Payment recorded', type: PaymentDto })
  async recordPayment(@Body() dto: RecordPaymentDto): Promise<Payment> {
    return this.billingService.recordPayment(dto);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Payment details', type: PaymentDto })
  async findPayment(@Param('id') id: string): Promise<Payment> {
    return this.billingService.findPaymentById(id);
  }

  @Post('payments/:id/allocations')
  @ApiOperation({ summary: 'Allocate payment to charge' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Payment allocated', type: PaymentAllocationDto })
  async allocate(@Param('id') id: string, @Body() dto: ApplyAmountDto): Promise<PaymentAllocation> {
    return this.billingService.allocatePayment(id, dto.targetId, dto.amount);
  }

  @Post('payments/:id/deposit-applications')
  @ApiOperation({ summary: 'Apply payment to deposit' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Deposit application created', type: DepositPaymentApplicationDto })
  async applyDeposit(@Param('id') id: string, @Body() dto: ApplyAmountDto): Promise<DepositPaymentApplication> {
    return this.billingService.applyPaymentToDeposit(id, dto.targetId, dto.amount);
  }
}

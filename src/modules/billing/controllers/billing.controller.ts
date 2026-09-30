import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BillingCycle, DepositPaymentApplication, Payment, PaymentAllocation } from '../contracts';
import { ApplyAmountDto, CreateBillingCycleDto, RecordPaymentDto } from '../dto';
import { BillingService } from '../services/billing.service';

@ApiTags('Finance')
@Controller('finance')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}
  @Post('cycles') async createCycle(@Body() dto: CreateBillingCycleDto): Promise<BillingCycle> { return this.billingService.createCycle(dto); }
  @Get('cycles') async findCycles(@Query('tenancyId') tenancyId?: string): Promise<BillingCycle[]> { return this.billingService.findByTenancyId(tenancyId); }
  @Get('cycles/:id') async findCycle(@Param('id') id: string): Promise<BillingCycle> { return this.billingService.findById(id); }
  @Post('payments') async recordPayment(@Body() dto: RecordPaymentDto): Promise<Payment> { return this.billingService.recordPayment(dto); }
  @Get('payments/:id') async findPayment(@Param('id') id: string): Promise<Payment> { return this.billingService.findPaymentById(id); }
  @Post('payments/:id/allocations') async allocate(@Param('id') id: string, @Body() dto: ApplyAmountDto): Promise<PaymentAllocation> { return this.billingService.allocatePayment(id, dto.targetId, dto.amount); }
  @Post('payments/:id/deposit-applications') async applyDeposit(@Param('id') id: string, @Body() dto: ApplyAmountDto): Promise<DepositPaymentApplication> { return this.billingService.applyPaymentToDeposit(id, dto.targetId, dto.amount); }
}

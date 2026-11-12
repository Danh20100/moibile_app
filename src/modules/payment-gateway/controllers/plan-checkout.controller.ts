import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import { PlanCheckoutService, type PlanCheckoutView } from '../services/plan-checkout.service';

class CreatePlanCheckoutDto {
  @IsUUID()
  purchaseId!: string;
}

@Controller('finance')
export class PlanCheckoutController {
  constructor(@Inject(PlanCheckoutService) private readonly plans: PlanCheckoutService) {}

  @Post('plan-checkouts')
  create(
    @Body() dto: CreatePlanCheckoutDto,
    @Headers('idempotency-key') key: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<PlanCheckoutView> {
    return this.plans.create(user.userId, dto.purchaseId, key);
  }

  @Post('plan-checkouts/:id/reconcile')
  reconcile(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<PlanCheckoutView> {
    return this.plans.reconcile(user.userId, id);
  }

  @Get('plan-entitlements')
  list(@CurrentUser() user: VerifiedPrincipal): Promise<Array<{ purchaseId: string; validUntil: string }>> {
    return this.plans.list(user.userId);
  }
}

import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import { SlotCheckoutService, type SlotCheckoutView } from '../services/slot-checkout.service';

class CreateSlotCheckoutDto {
  @IsUUID()
  purchaseId!: string;
}

@Controller('finance')
export class SlotCheckoutController {
  constructor(@Inject(SlotCheckoutService) private readonly slots: SlotCheckoutService) {}

  @Post('slot-checkouts')
  create(
    @Body() dto: CreateSlotCheckoutDto,
    @Headers('idempotency-key') key: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<SlotCheckoutView> {
    return this.slots.create(user.userId, dto.purchaseId, key);
  }

  @Post('slot-checkouts/:id/reconcile')
  reconcile(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<SlotCheckoutView> {
    return this.slots.reconcile(user.userId, id);
  }

  @Get('slot-entitlements')
  list(@CurrentUser() user: VerifiedPrincipal): Promise<Array<{ purchaseId: string; validUntil: string }>> {
    return this.slots.list(user.userId);
  }
}

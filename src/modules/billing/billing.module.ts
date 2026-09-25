import { Module } from '@nestjs/common';

import { RoomModule } from '../room/room.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { BillingController } from './controllers/billing.controller';
import { BillingService } from './services/billing.service';

@Module({
  imports: [TenancyModule, RoomModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

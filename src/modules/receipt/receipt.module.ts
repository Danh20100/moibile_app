import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';

import { BillingModule } from '../billing/billing.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ReceiptController } from './controllers/receipt.controller';
import { ReceiptService } from './services/receipt.service';

@Module({
  imports: [DatabaseModule, BillingModule, TenancyModule],
  controllers: [ReceiptController],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule {}

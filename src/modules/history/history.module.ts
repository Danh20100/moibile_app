import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { IncidentModule } from '../incident/incident.module';
import { ListingModule } from '../listing/listing.module';
import { ReceiptModule } from '../receipt/receipt.module';
import { RoomModule } from '../room/room.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { HistoryController } from './controllers/history.controller';
import { RentalHistoryService } from './services/rental-history.service';

@Module({
  imports: [TenancyModule, BillingModule, ReceiptModule, IncidentModule, RoomModule, ListingModule],
  controllers: [HistoryController],
  providers: [RentalHistoryService],
  exports: [RentalHistoryService],
})
export class HistoryModule {}

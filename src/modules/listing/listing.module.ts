import { Module } from '@nestjs/common';

import { PropertyModule } from '../property/property.module';
import { RoomModule } from '../room/room.module';
import { ListingController } from './controllers/listing.controller';
import { ListingService } from './services/listing.service';

@Module({
  imports: [RoomModule, PropertyModule],
  controllers: [ListingController],
  providers: [ListingService],
  exports: [ListingService],
})
export class ListingModule {}

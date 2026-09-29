import { Module } from '@nestjs/common';

import { ListingModule } from '../listing/listing.module';
import { PropertyModule } from '../property/property.module';
import { RoomModule } from '../room/room.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { RentalLifecycleController } from './controllers/rental-lifecycle.controller';
import { RentalLifecycleCoordinator } from './services/rental-lifecycle.coordinator';

@Module({
  imports: [PropertyModule, RoomModule, ListingModule, TenancyModule],
  controllers: [RentalLifecycleController],
  providers: [RentalLifecycleCoordinator],
})
export class RentalLifecycleModule {}

import { Module } from '@nestjs/common';

import { RoomModule } from '../room/room.module';
import { TenancyController } from './controllers/tenancy.controller';
import { TenancyService } from './services/tenancy.service';

@Module({
  imports: [RoomModule],
  controllers: [TenancyController],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}

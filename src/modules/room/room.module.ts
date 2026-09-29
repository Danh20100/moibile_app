import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';

import { PropertyModule } from '../property/property.module';
import { RoomController } from './controllers/room.controller';
import { RoomService } from './services/room.service';

@Module({
  imports: [DatabaseModule, PropertyModule],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}

import { Module } from '@nestjs/common';

import { RoomController } from './controllers/room.controller';
import { RoomService } from './services/room.service';

@Module({
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}

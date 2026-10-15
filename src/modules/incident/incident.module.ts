import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';

import { RoomModule } from '../room/room.module';
import { IncidentController } from './controllers/incident.controller';
import { IncidentService } from './services/incident.service';

@Module({
  imports: [DatabaseModule, RoomModule],
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}

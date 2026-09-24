import { Module } from '@nestjs/common';

import { IncidentController } from './controllers/incident.controller';
import { IncidentService } from './services/incident.service';

@Module({
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}

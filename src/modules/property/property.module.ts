import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';

import { OrganizationModule } from '../organization/organization.module';
import { PropertyController } from './controllers/property.controller';
import { PropertyService } from './services/property.service';

@Module({
  imports: [DatabaseModule, OrganizationModule],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}

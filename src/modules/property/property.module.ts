import { Module } from '@nestjs/common';

import { OrganizationModule } from '../organization/organization.module';
import { PropertyController } from './controllers/property.controller';
import { PropertyService } from './services/property.service';

@Module({
  imports: [OrganizationModule],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}

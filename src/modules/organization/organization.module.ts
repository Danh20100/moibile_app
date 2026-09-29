import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';

import { OrganizationController } from './controllers/organization.controller';
import { OrganizationService } from './services/organization.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}

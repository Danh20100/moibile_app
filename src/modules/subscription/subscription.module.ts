import { Module } from '@nestjs/common';

import { OrganizationModule } from '../organization/organization.module';
import { SubscriptionController } from './controllers/subscription.controller';
import { SubscriptionService } from './services/subscription.service';

@Module({
  imports: [OrganizationModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}

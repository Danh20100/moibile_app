import { Module } from '@nestjs/common';

import { TenancyController } from './controllers/tenancy.controller';
import { TenancyService } from './services/tenancy.service';

@Module({
  controllers: [TenancyController],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}

import { Module } from '@nestjs/common';

import { IdentityAccessController } from './controllers/identity-access.controller';
import { IdentityAccessService } from './services/identity-access.service';

@Module({
  controllers: [IdentityAccessController],
  providers: [IdentityAccessService],
  exports: [IdentityAccessService],
})
export class IdentityAccessModule {}

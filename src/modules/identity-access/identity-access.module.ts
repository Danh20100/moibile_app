import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';

import { IdentityAccessController } from './controllers/identity-access.controller';
import { IdentityAccessService } from './services/identity-access.service';

@Module({
  imports: [DatabaseModule],
  controllers: [IdentityAccessController],
  providers: [IdentityAccessService],
  exports: [IdentityAccessService],
})
export class IdentityAccessModule {}

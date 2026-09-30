import { Global, Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ResourceAuthorizationService } from './resource-authorization.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ResourceAuthorizationService],
  exports: [ResourceAuthorizationService],
})
export class ResourceAuthorizationModule {}

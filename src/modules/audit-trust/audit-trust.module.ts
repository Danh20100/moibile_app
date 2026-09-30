import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';

import { AuditTrustController } from './controllers/audit-trust.controller';
import { AuditTrustService } from './services/audit-trust.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditTrustController],
  providers: [AuditTrustService],
  exports: [AuditTrustService],
})
export class AuditTrustModule {}

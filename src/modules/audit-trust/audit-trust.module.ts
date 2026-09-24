import { Module } from '@nestjs/common';

import { AuditTrustController } from './controllers/audit-trust.controller';
import { AuditTrustService } from './services/audit-trust.service';

@Module({
  controllers: [AuditTrustController],
  providers: [AuditTrustService],
  exports: [AuditTrustService],
})
export class AuditTrustModule {}

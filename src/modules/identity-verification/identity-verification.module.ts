import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AutoIdentityCheckController } from './auto-identity-check.controller';
import { AutoIdentityCheckService } from './auto-identity-check.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AutoIdentityCheckController],
  providers: [AutoIdentityCheckService],
})
export class IdentityVerificationModule {}

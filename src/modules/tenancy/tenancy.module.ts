import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';

import { TenancySupportController } from './controllers/tenancy-support.controller';
import { TenancyJoinController } from './controllers/tenancy-join.controller';
import { TenancyController } from './controllers/tenancy.controller';
import { TenancyNoticeService } from './services/tenancy-notice.service';
import { TenancyParticipantService } from './services/tenancy-participant.service';
import { TenancyTermsService } from './services/tenancy-terms.service';
import { TenancyService } from './services/tenancy.service';
import { TenancyJoinService } from './services/tenancy-join.service';
import { TermsAcknowledgementService } from './services/terms-acknowledgement.service';

const SUPPORT_PROVIDERS = [
  TenancyParticipantService,
  TenancyTermsService,
  TermsAcknowledgementService,
  TenancyNoticeService,
  TenancyJoinService,
];

@Module({
  imports: [DatabaseModule],
  controllers: [TenancyController, TenancySupportController, TenancyJoinController],
  providers: [TenancyService, ...SUPPORT_PROVIDERS],
  exports: [TenancyService, ...SUPPORT_PROVIDERS],
})
export class TenancyModule {}

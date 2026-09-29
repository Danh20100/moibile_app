import { Module } from '@nestjs/common';

import { TenancySupportController } from './controllers/tenancy-support.controller';
import { TenancyController } from './controllers/tenancy.controller';
import { TenancyNoticeService } from './services/tenancy-notice.service';
import { TenancyParticipantService } from './services/tenancy-participant.service';
import { TenancyTermsService } from './services/tenancy-terms.service';
import { TenancyService } from './services/tenancy.service';
import { TermsAcknowledgementService } from './services/terms-acknowledgement.service';

const SUPPORT_PROVIDERS = [
  TenancyParticipantService,
  TenancyTermsService,
  TermsAcknowledgementService,
  TenancyNoticeService,
];

@Module({
  controllers: [TenancyController, TenancySupportController],
  providers: [TenancyService, ...SUPPORT_PROVIDERS],
  exports: [TenancyService, ...SUPPORT_PROVIDERS],
})
export class TenancyModule {}

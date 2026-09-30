import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  TenancyNotice,
  TenancyParticipant,
  TenancyTerms,
  TermsAcknowledgement,
} from '../contracts';
import {
  AcknowledgeTenancyNoticeDto,
  AddTenancyParticipantDto,
  CreateTenancyTermsDto,
  CreateTermsAcknowledgementDto,
  IssueTenancyNoticeDto,
  LinkParticipantUserDto,
  ParticipantOccurredAtDto,
} from '../dto';
import { TenancyNoticeService } from '../services/tenancy-notice.service';
import { TenancyParticipantService } from '../services/tenancy-participant.service';
import { TenancyTermsService } from '../services/tenancy-terms.service';
import { TermsAcknowledgementService } from '../services/terms-acknowledgement.service';

@ApiTags('Tenancy Support')
@Controller('tenancies')
export class TenancySupportController {
  constructor(
    private readonly participants: TenancyParticipantService,
    private readonly terms: TenancyTermsService,
    private readonly acknowledgements: TermsAcknowledgementService,
    private readonly notices: TenancyNoticeService,
  ) {}

  @Post(':tenancyId/participants')
  async addParticipant(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: AddTenancyParticipantDto,
  ): Promise<TenancyParticipant> {
    return this.participants.add({ tenancyId, ...dto });
  }

  @Get(':tenancyId/participants')
  async listActiveParticipants(@Param('tenancyId') tenancyId: string): Promise<TenancyParticipant[]> {
    return this.participants.listActiveByTenancyId(tenancyId);
  }

  @Post(':tenancyId/participants/:participantId/leave')
  async leaveOccupant(
    @Param('participantId') participantId: string,
    @Body() dto: ParticipantOccurredAtDto,
  ): Promise<TenancyParticipant> {
    return this.participants.leaveOccupant(participantId, dto.occurredAt);
  }

  @Post(':tenancyId/participants/:participantId/link-user')
  async linkUser(
    @Param('participantId') participantId: string,
    @Body() dto: LinkParticipantUserDto,
  ): Promise<TenancyParticipant> {
    return this.participants.linkUser(participantId, dto.userId);
  }

  @Post(':tenancyId/terms')
  async createTerms(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: CreateTenancyTermsDto,
  ): Promise<TenancyTerms> {
    return this.terms.createVersion({ tenancyId, ...dto });
  }

  @Get(':tenancyId/terms')
  async listTerms(@Param('tenancyId') tenancyId: string): Promise<TenancyTerms[]> {
    return this.terms.listByTenancyId(tenancyId);
  }

  @Get(':tenancyId/terms/:termsId')
  async findTerms(@Param('termsId') termsId: string): Promise<TenancyTerms> {
    return this.terms.findById(termsId);
  }

  @Post(':tenancyId/terms/:termsId/acknowledgements')
  async acknowledgeTerms(
    @Param('termsId') termsId: string,
    @Body() dto: CreateTermsAcknowledgementDto,
  ): Promise<TermsAcknowledgement> {
    return this.acknowledgements.acknowledge({ tenancyTermsId: termsId, ...dto });
  }

  @Post(':tenancyId/notices')
  async issueNotice(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: IssueTenancyNoticeDto,
  ): Promise<TenancyNotice> {
    return this.notices.issue({ tenancyId, ...dto });
  }

  @Get(':tenancyId/notices')
  async listNotices(@Param('tenancyId') tenancyId: string): Promise<TenancyNotice[]> {
    return this.notices.listByTenancyId(tenancyId);
  }

  @Post(':tenancyId/notices/:noticeId/acknowledge')
  async acknowledgeNotice(
    @Param('noticeId') noticeId: string,
    @Body() dto: AcknowledgeTenancyNoticeDto,
  ): Promise<TenancyNotice> {
    return this.notices.acknowledge(noticeId, dto.userId, dto.occurredAt);
  }
}

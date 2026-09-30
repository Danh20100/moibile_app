import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import type {
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
  TenancyNoticeDto,
  TenancyParticipantDto,
  TenancyTermsDto,
  TermsAcknowledgementDto,
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
  @ApiOperation({ summary: 'Add a participant to tenancy' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 201, description: 'Participant added', type: TenancyParticipantDto })
  async addParticipant(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: AddTenancyParticipantDto,
  ): Promise<TenancyParticipant> {
    return this.participants.add({ tenancyId, ...dto });
  }

  @Get(':tenancyId/participants')
  @ApiOperation({ summary: 'List active participants of tenancy' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 200, description: 'List of active participants', type: [TenancyParticipantDto] })
  async listActiveParticipants(@Param('tenancyId') tenancyId: string): Promise<TenancyParticipant[]> {
    return this.participants.listActiveByTenancyId(tenancyId);
  }

  @Post(':tenancyId/participants/:participantId/leave')
  @ApiOperation({ summary: 'Record participant leave' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'participantId', type: String })
  @ApiResponse({ status: 200, description: 'Participant updated', type: TenancyParticipantDto })
  async leaveOccupant(
    @Param('participantId') participantId: string,
    @Body() dto: ParticipantOccurredAtDto,
  ): Promise<TenancyParticipant> {
    return this.participants.leaveOccupant(participantId, dto.occurredAt);
  }

  @Post(':tenancyId/participants/:participantId/link-user')
  @ApiOperation({ summary: 'Link user ID to participant' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'participantId', type: String })
  @ApiResponse({ status: 200, description: 'Participant linked', type: TenancyParticipantDto })
  async linkUser(
    @Param('participantId') participantId: string,
    @Body() dto: LinkParticipantUserDto,
  ): Promise<TenancyParticipant> {
    return this.participants.linkUser(participantId, dto.userId);
  }

  @Post(':tenancyId/terms')
  @ApiOperation({ summary: 'Create new version of tenancy terms' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 201, description: 'Terms created', type: TenancyTermsDto })
  async createTerms(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: CreateTenancyTermsDto,
  ): Promise<TenancyTerms> {
    return this.terms.createVersion({ tenancyId, ...dto });
  }

  @Get(':tenancyId/terms')
  @ApiOperation({ summary: 'List terms versions of tenancy' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 200, description: 'List of terms', type: [TenancyTermsDto] })
  async listTerms(@Param('tenancyId') tenancyId: string): Promise<TenancyTerms[]> {
    return this.terms.listByTenancyId(tenancyId);
  }

  @Get(':tenancyId/terms/:termsId')
  @ApiOperation({ summary: 'Get tenancy terms version by ID' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'termsId', type: String })
  @ApiResponse({ status: 200, description: 'Tenancy terms', type: TenancyTermsDto })
  async findTerms(@Param('termsId') termsId: string): Promise<TenancyTerms> {
    return this.terms.findById(termsId);
  }

  @Post(':tenancyId/terms/:termsId/acknowledgements')
  @ApiOperation({ summary: 'Acknowledge tenancy terms' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'termsId', type: String })
  @ApiResponse({ status: 201, description: 'Terms acknowledged', type: TermsAcknowledgementDto })
  async acknowledgeTerms(
    @Param('termsId') termsId: string,
    @Body() dto: CreateTermsAcknowledgementDto,
  ): Promise<TermsAcknowledgement> {
    return this.acknowledgements.acknowledge({ tenancyTermsId: termsId, ...dto });
  }

  @Post(':tenancyId/notices')
  @ApiOperation({ summary: 'Issue tenancy notice' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 201, description: 'Notice issued', type: TenancyNoticeDto })
  async issueNotice(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: IssueTenancyNoticeDto,
  ): Promise<TenancyNotice> {
    return this.notices.issue({ tenancyId, ...dto });
  }

  @Get(':tenancyId/notices')
  @ApiOperation({ summary: 'List notices of tenancy' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 200, description: 'List of notices', type: [TenancyNoticeDto] })
  async listNotices(@Param('tenancyId') tenancyId: string): Promise<TenancyNotice[]> {
    return this.notices.listByTenancyId(tenancyId);
  }

  @Post(':tenancyId/notices/:noticeId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge tenancy notice' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'noticeId', type: String })
  @ApiResponse({ status: 200, description: 'Notice acknowledged', type: TenancyNoticeDto })
  async acknowledgeNotice(
    @Param('noticeId') noticeId: string,
    @Body() dto: AcknowledgeTenancyNoticeDto,
  ): Promise<TenancyNotice> {
    return this.notices.acknowledge(noticeId, dto.userId, dto.occurredAt);
  }
}

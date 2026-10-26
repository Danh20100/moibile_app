import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
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
    @Inject(TenancyParticipantService)
    private readonly participants: TenancyParticipantService,
    @Inject(TenancyTermsService)
    private readonly terms: TenancyTermsService,
    @Inject(TermsAcknowledgementService)
    private readonly acknowledgements: TermsAcknowledgementService,
    @Inject(TenancyNoticeService)
    private readonly notices: TenancyNoticeService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post(':tenancyId/participants')
  @ApiOperation({ summary: 'Add a participant to tenancy' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 201, description: 'Participant added', type: TenancyParticipantDto })
  async addParticipant(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: AddTenancyParticipantDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyParticipant> {
    if (user) {
      await this.authz.assertOperatesTenancy(user.userId, tenancyId);
    }
    return this.participants.add({ tenancyId, ...dto });
  }

  @Get(':tenancyId/participants')
  @ApiOperation({ summary: 'List active participants of tenancy' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of active participants',
    type: [TenancyParticipantDto],
  })
  async listActiveParticipants(
    @Param('tenancyId') tenancyId: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyParticipant[]> {
    if (user) {
      await this.authz.assertCanAccessTenancy(user.userId, tenancyId);
    }
    return this.participants.listActiveByTenancyId(tenancyId);
  }

  @Post(':tenancyId/participants/:participantId/leave')
  @ApiOperation({ summary: 'Record participant leave' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'participantId', type: String })
  @ApiResponse({ status: 200, description: 'Participant updated', type: TenancyParticipantDto })
  async leaveOccupant(
    @Param('tenancyId') tenancyId: string,
    @Param('participantId') participantId: string,
    @Body() dto: ParticipantOccurredAtDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyParticipant> {
    if (user) {
      const isOp = await this.authz.isOperatorOfTenancy(user.userId, tenancyId);
      if (!isOp) {
        const participant = await this.participants.findById(participantId);
        if (participant.userId !== user.userId) {
          throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
        }
      }
    }
    return this.participants.leaveOccupant(participantId, dto.occurredAt);
  }

  @Post(':tenancyId/participants/:participantId/link-user')
  @ApiOperation({ summary: 'Link user ID to participant' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'participantId', type: String })
  @ApiResponse({ status: 200, description: 'Participant linked', type: TenancyParticipantDto })
  async linkUser(
    @Param('tenancyId') tenancyId: string,
    @Param('participantId') participantId: string,
    @Body() dto: LinkParticipantUserDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyParticipant> {
    if (user) {
      const isOp = await this.authz.isOperatorOfTenancy(user.userId, tenancyId);
      if (!isOp) {
        throw new ForbiddenException('Người thuê cần dùng link mời để liên kết tài khoản');
      }
    }
    return this.participants.linkUser(participantId, dto.userId);
  }

  @Post(':tenancyId/terms')
  @ApiOperation({ summary: 'Create new version of tenancy terms' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 201, description: 'Terms created', type: TenancyTermsDto })
  async createTerms(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: CreateTenancyTermsDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyTerms> {
    if (user) {
      await this.authz.assertOperatesTenancy(user.userId, tenancyId);
    }
    return this.terms.createVersion({ tenancyId, ...dto });
  }

  @Get(':tenancyId/terms')
  @ApiOperation({ summary: 'List terms versions of tenancy' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 200, description: 'List of terms', type: [TenancyTermsDto] })
  async listTerms(
    @Param('tenancyId') tenancyId: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyTerms[]> {
    if (user) {
      await this.authz.assertCanReadTenancy(user.userId, tenancyId);
    }
    return this.terms.listByTenancyId(tenancyId);
  }

  @Get(':tenancyId/terms/:termsId')
  @ApiOperation({ summary: 'Get tenancy terms version by ID' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'termsId', type: String })
  @ApiResponse({ status: 200, description: 'Tenancy terms', type: TenancyTermsDto })
  async findTerms(
    @Param('tenancyId') tenancyId: string,
    @Param('termsId') termsId: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyTerms> {
    if (user) {
      await this.authz.assertCanReadTenancy(user.userId, tenancyId);
    }
    return this.terms.findById(termsId);
  }

  @Post(':tenancyId/terms/:termsId/acknowledgements')
  @ApiOperation({ summary: 'Acknowledge tenancy terms' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'termsId', type: String })
  @ApiResponse({ status: 201, description: 'Terms acknowledged', type: TermsAcknowledgementDto })
  async acknowledgeTerms(
    @Param('tenancyId') tenancyId: string,
    @Param('termsId') termsId: string,
    @Body() dto: CreateTermsAcknowledgementDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TermsAcknowledgement> {
    if (!user) {
      throw new UnauthorizedException('Verified principal is required');
    }
    await this.authz.assertCanAccessTenancy(user.userId, tenancyId);
    const terms = await this.terms.findById(termsId);
    if (terms.tenancyId !== tenancyId) {
      throw new NotFoundException(`Terms not found in Tenancy: ${termsId}`);
    }
    return this.acknowledgements.acknowledge({
      tenancyTermsId: termsId,
      tenancyParticipantId: dto.tenancyParticipantId,
      userId: user.userId,
      acknowledgedAt: dto.acknowledgedAt,
    });
  }

  @Post(':tenancyId/notices')
  @ApiOperation({ summary: 'Issue tenancy notice' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 201, description: 'Notice issued', type: TenancyNoticeDto })
  async issueNotice(
    @Param('tenancyId') tenancyId: string,
    @Body() dto: IssueTenancyNoticeDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyNotice> {
    if (!user) {
      throw new UnauthorizedException('Verified principal is required');
    }
    await this.authz.assertOperatesTenancy(user.userId, tenancyId);
    return this.notices.issue({
      tenancyId,
      noticeType: dto.noticeType,
      issuedByUserId: user.userId,
      contentOrNote: dto.contentOrNote,
      issuedAt: dto.issuedAt,
    });
  }

  @Get(':tenancyId/notices')
  @ApiOperation({ summary: 'List notices of tenancy' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 200, description: 'List of notices', type: [TenancyNoticeDto] })
  async listNotices(
    @Param('tenancyId') tenancyId: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyNotice[]> {
    if (user) {
      await this.authz.assertCanReadTenancy(user.userId, tenancyId);
    }
    return this.notices.listByTenancyId(tenancyId);
  }

  @Post(':tenancyId/notices/:noticeId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge tenancy notice' })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiParam({ name: 'noticeId', type: String })
  @ApiResponse({ status: 200, description: 'Notice acknowledged', type: TenancyNoticeDto })
  async acknowledgeNotice(
    @Param('tenancyId') tenancyId: string,
    @Param('noticeId') noticeId: string,
    @Body() dto: AcknowledgeTenancyNoticeDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyNotice> {
    if (!user) {
      throw new UnauthorizedException('Verified principal is required');
    }
    const notice = await this.notices.findById(noticeId);
    if (notice.tenancyId !== tenancyId) {
      throw new NotFoundException(`Notice not found in Tenancy: ${noticeId}`);
    }
    if (!(await this.authz.isParticipantInTenancy(user.userId, tenancyId))) {
      throw new ForbiddenException('Only an active linked participant may acknowledge this notice');
    }
    return this.notices.acknowledge(noticeId, user.userId, dto.occurredAt);
  }
}

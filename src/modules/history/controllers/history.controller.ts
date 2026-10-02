import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { RentalHistoryProjection, RoomOperationalHistoryProjection } from '../contracts';
import { RentalHistoryProjectionDto, RoomOperationalHistoryProjectionDto } from '../dto';
import { RentalHistoryService } from '../services/rental-history.service';

@ApiTags('History')
@ApiBearerAuth('bearer')
@Controller()
export class HistoryController {
  constructor(
    @Inject(RentalHistoryService) private readonly history: RentalHistoryService,
    @Inject(ResourceAuthorizationService) private readonly authz: ResourceAuthorizationService,
  ) {}

  @Get('tenancies/:tenancyId/history')
  @ApiOperation({
    summary: 'Read source-backed rental history for an operated or historically linked Tenancy',
  })
  @ApiParam({ name: 'tenancyId', type: String })
  @ApiResponse({ status: 200, type: RentalHistoryProjectionDto })
  @ApiResponse({ status: 403, description: 'Current user has no operator or participant history access' })
  @ApiResponse({ status: 404, description: 'Tenancy not found' })
  async findByTenancy(
    @Param('tenancyId') tenancyId: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<RentalHistoryProjection> {
    await this.authz.assertCanReadTenancy(user.userId, tenancyId);
    return this.history.forTenancy(tenancyId);
  }

  @Get('rooms/:roomId/history')
  @ApiOperation({
    summary: 'Read source-backed operational history for an operated Room',
  })
  @ApiParam({ name: 'roomId', type: String })
  @ApiResponse({ status: 200, type: RoomOperationalHistoryProjectionDto })
  @ApiResponse({ status: 403, description: 'Current user does not operate the Room' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findByRoom(
    @Param('roomId') roomId: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<RoomOperationalHistoryProjection> {
    await this.authz.assertOperatesRoom(user.userId, roomId);
    return this.history.forRoom(roomId);
  }
}

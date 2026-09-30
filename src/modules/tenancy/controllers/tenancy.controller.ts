import { Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { TenancyProfile } from '../contracts';
import { TenancyProfileDto } from '../dto';
import { TenancyService } from '../services/tenancy.service';

@ApiTags('Tenancy')
@Controller('tenancies')
export class TenancyController {
  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Find tenancies (optionally filtered by roomId)' })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of tenancies', type: [TenancyProfileDto] })
  async findByRoomId(
    @Query('roomId') roomId?: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyProfile[]> {
    if (roomId) {
      if (user) {
        await this.authz.assertCanAccessRoom(user.userId, roomId);
      }
      return this.tenancyService.findByRoomId(roomId);
    }
    if (user) {
      const all = await this.tenancyService.findByRoomId();
      const accessible = await Promise.all(
        all.map(async (t) => {
          try {
            await this.authz.assertCanAccessTenancy(user.userId, t.id);
            return t;
          } catch {
            return null;
          }
        }),
      );
      return accessible.filter((t): t is TenancyProfile => t !== null);
    }
    return this.tenancyService.findByRoomId();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Tenancy by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Tenancy details', type: TenancyProfileDto })
  @ApiResponse({ status: 404, description: 'Tenancy not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyProfile> {
    if (user) {
      await this.authz.assertCanAccessTenancy(user.userId, id);
    }
    return this.tenancyService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a DRAFT Tenancy before activation' })
  @ApiParam({ name: 'id', type: String, description: 'Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Cancelled tenancy', type: TenancyProfileDto })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyProfile> {
    if (user) {
      await this.authz.assertOperatesTenancy(user.userId, id);
    }
    return this.tenancyService.cancel(id);
  }

  @Post(':id/start-ending')
  @ApiOperation({ summary: 'Start move-out workflow without making Room vacant' })
  @ApiParam({ name: 'id', type: String, description: 'Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Ending tenancy', type: TenancyProfileDto })
  async startEnding(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyProfile> {
    if (user) {
      await this.authz.assertCanAccessTenancy(user.userId, id);
    }
    return this.tenancyService.startEnding(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume ACTIVE state from ENDING' })
  @ApiParam({ name: 'id', type: String, description: 'Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Resumed tenancy', type: TenancyProfileDto })
  async resume(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyProfile> {
    if (user) {
      await this.authz.assertOperatesTenancy(user.userId, id);
    }
    return this.tenancyService.resumeActive(id);
  }
}

import { Body, Controller, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { ListingProfile } from '../../listing/contracts';
import { CreateListingDto, ListingProfileDto } from '../../listing/dto';
import type { RoomProfile } from '../../room/contracts';
import { RoomProfileDto } from '../../room/dto';
import type { TenancyProfile } from '../../tenancy/contracts';
import { TenancyProfileDto } from '../../tenancy/dto';
import {
  ActivateTenancyDto,
  CheckoutTenancyDto,
  CreateTenancyDto,
  ListingCommandContextDto,
  TransitionRoomManuallyDto,
} from '../dto';
import { RentalLifecycleCoordinator } from '../services/rental-lifecycle.coordinator';

@ApiTags('Rental lifecycle')
@Controller()
export class RentalLifecycleController {
  constructor(
    @Inject(RentalLifecycleCoordinator)
    private readonly coordinator: RentalLifecycleCoordinator,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post('listings')
  @ApiOperation({ summary: 'Create a new Listing' })
  @ApiResponse({ status: 201, description: 'Listing created', type: ListingProfileDto })
  async createListing(
    @Body() dto: CreateListingDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ListingProfile> {
    if (user) {
      await this.authz.assertOperatesRoom(user.userId, dto.roomId);
    }
    return this.coordinator.createListing(dto);
  }

  @Post('listings/:id/publish')
  @ApiOperation({ summary: 'Publish a Listing' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Listing published', type: ListingProfileDto })
  async publishListing(
    @Param('id') id: string,
    @Body() dto: ListingCommandContextDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ListingProfile> {
    if (user) {
      await this.authz.assertOperatesListing(user.userId, id);
    }
    return this.coordinator.publishListing(id, dto);
  }

  @Patch('rooms/:id/operational-state')
  @ApiOperation({ summary: 'Transition room operational state manually' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Room operational state updated', type: RoomProfileDto })
  async transitionRoomManually(
    @Param('id') id: string,
    @Body() dto: TransitionRoomManuallyDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<RoomProfile> {
    if (user) {
      await this.authz.assertOperatesRoom(user.userId, id);
    }
    return this.coordinator.transitionRoomManually(id, dto.operationalState, dto);
  }

  @Post('tenancies')
  @ApiOperation({ summary: 'Create a new draft tenancy' })
  @ApiResponse({ status: 201, description: 'Tenancy created', type: TenancyProfileDto })
  async createTenancy(
    @Body() dto: CreateTenancyDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyProfile> {
    if (user) {
      await this.authz.assertOperatesRoom(user.userId, dto.roomId);
    }
    return this.coordinator.createTenancy(dto.roomId);
  }

  @Post('tenancies/:id/activate')
  @ApiOperation({ summary: 'Activate a tenancy' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Tenancy activated', type: TenancyProfileDto })
  async activateTenancy(
    @Param('id') id: string,
    @Body() dto: ActivateTenancyDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyProfile> {
    if (user) {
      await this.authz.assertOperatesTenancy(user.userId, id);
    }
    return this.coordinator.activateTenancy(id, dto, dto.occurredAt);
  }

  @Post('tenancies/:id/checkout')
  @ApiOperation({ summary: 'Checkout a tenancy' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Tenancy checked out', type: TenancyProfileDto })
  async checkoutTenancy(
    @Param('id') id: string,
    @Body() dto: CheckoutTenancyDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<TenancyProfile> {
    if (user) {
      await this.authz.assertOperatesTenancy(user.userId, id);
    }
    return this.coordinator.checkoutTenancy(id, dto.endReason, dto.occurredAt);
  }
}

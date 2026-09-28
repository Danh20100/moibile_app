import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateListingDto } from '../../listing/dto';
import { ListingProfile } from '../../listing/contracts';
import { RoomProfile } from '../../room/contracts';
import { TenancyProfile } from '../../tenancy/contracts';
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
  constructor(private readonly coordinator: RentalLifecycleCoordinator) {}

  @Post('listings')
  async createListing(@Body() dto: CreateListingDto): Promise<ListingProfile> {
    return this.coordinator.createListing(dto);
  }

  @Post('listings/:id/publish')
  async publishListing(
    @Param('id') id: string,
    @Body() dto: ListingCommandContextDto,
  ): Promise<ListingProfile> {
    return this.coordinator.publishListing(id, dto);
  }

  @Patch('rooms/:id/operational-state')
  async transitionRoomManually(
    @Param('id') id: string,
    @Body() dto: TransitionRoomManuallyDto,
  ): Promise<RoomProfile> {
    return this.coordinator.transitionRoomManually(id, dto.operationalState, dto);
  }

  @Post('tenancies')
  async createTenancy(@Body() dto: CreateTenancyDto): Promise<TenancyProfile> {
    return this.coordinator.createTenancy(dto.roomId);
  }

  @Post('tenancies/:id/activate')
  async activateTenancy(
    @Param('id') id: string,
    @Body() dto: ActivateTenancyDto,
  ): Promise<TenancyProfile> {
    return this.coordinator.activateTenancy(id, dto, dto.occurredAt);
  }

  @Post('tenancies/:id/checkout')
  async checkoutTenancy(
    @Param('id') id: string,
    @Body() dto: CheckoutTenancyDto,
  ): Promise<TenancyProfile> {
    return this.coordinator.checkoutTenancy(id, dto.endReason, dto.occurredAt);
  }
}

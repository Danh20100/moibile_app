import { BadRequestException, Injectable } from '@nestjs/common';

import {
  CreateListingInput,
  ListingProfile,
  ListingTransitionEventInput,
} from '../../listing/contracts';
import { ListingService } from '../../listing/services/listing.service';
import { PropertyService } from '../../property/services/property.service';
import { RoomOperationalState, RoomProfile } from '../../room/contracts';
import { RoomService } from '../../room/services/room.service';
import { TenancyEndReason, TenancyProfile } from '../../tenancy/contracts';
import { TenancyParticipantService } from '../../tenancy/services/tenancy-participant.service';
import { TenancyService } from '../../tenancy/services/tenancy.service';

@Injectable()
export class RentalLifecycleCoordinator {
  constructor(
    private readonly rooms: RoomService,
    private readonly properties: PropertyService,
    private readonly listings: ListingService,
    private readonly tenancies: TenancyService,
    private readonly participants: TenancyParticipantService,
  ) {}

  async createListing(input: CreateListingInput): Promise<ListingProfile> {
    await this.assertActiveAncestry(input.roomId);
    return this.listings.createDraft(input);
  }

  async publishListing(
    listingId: string,
    context: ListingTransitionEventInput,
  ): Promise<ListingProfile> {
    const listing = await this.listings.findById(listingId);
    await this.listings.assertTransition(listingId, 'published');
    const { room } = await this.assertActiveAncestry(listing.roomId);
    if (room.operationalState !== 'vacant') {
      throw new BadRequestException('Listing publish requires a VACANT Room');
    }
    this.assertRequiredListingFields(listing);
    await this.listings.assertAssetDetailsReadyToPublish(listingId);
    return this.listings.transition(listingId, 'published', context);
  }

  async transitionRoomManually(
    roomId: string,
    nextState: Extract<RoomOperationalState, 'vacant' | 'maintenance' | 'inactive'>,
    context: ListingTransitionEventInput,
  ): Promise<RoomProfile> {
    const room = await this.rooms.findById(roomId);
    const listing = await this.listings.findCurrentByRoomId(roomId);
    const reasonCode =
      room.operationalState === 'vacant' && nextState === 'maintenance'
        ? 'ROOM_MAINTENANCE'
        : room.operationalState === 'vacant' && nextState === 'inactive'
          ? 'ROOM_INACTIVE'
          : undefined;

    if (listing?.status === 'published' && reasonCode) {
      await this.listings.assertTransition(listing.id, 'unpublished');
      await this.listings.transition(listing.id, 'unpublished', { ...context, reasonCode });
    }
    return this.rooms.transitionOperationalState(roomId, nextState, 'manual');
  }

  async createTenancy(roomId: string): Promise<TenancyProfile> {
    await this.assertActiveAncestry(roomId);
    await this.tenancies.assertCanCreateForRoom(roomId);
    return this.tenancies.createDraft(roomId);
  }

  async activateTenancy(
    tenancyId: string,
    context: ListingTransitionEventInput,
    occurredAt: string,
  ): Promise<TenancyProfile> {
    const tenancy = await this.tenancies.findById(tenancyId);
    await this.tenancies.assertTransition(tenancyId, 'active');
    const { room } = await this.assertActiveAncestry(tenancy.roomId);
    if (room.operationalState !== 'vacant') {
      throw new BadRequestException('Tenancy activation requires a VACANT Room');
    }
    if (await this.tenancies.findNonTerminalByRoomId(tenancy.roomId, tenancy.id)) {
      throw new BadRequestException('Competing non-terminal Tenancy exists for Room');
    }
    await this.participants.assertExactlyOneActivePrimary(tenancy.id);
    const listing = await this.listings.findCurrentByRoomId(tenancy.roomId);
    if (listing?.status === 'published') {
      await this.listings.assertTransition(listing.id, 'unpublished');
    }

    if (listing?.status === 'published') {
      await this.listings.transition(listing.id, 'unpublished', {
        ...context,
        reasonCode: 'ROOM_OCCUPIED',
      });
    }
    const activeTenancy = await this.tenancies.activateLocal(tenancy.id, occurredAt);
    await this.rooms.transitionOperationalState(tenancy.roomId, 'occupied', 'tenancy_activated');
    return activeTenancy;
  }

  async checkoutTenancy(
    tenancyId: string,
    endReason: TenancyEndReason,
    occurredAt: string,
  ): Promise<TenancyProfile> {
    const tenancy = await this.tenancies.findById(tenancyId);
    await this.tenancies.assertCanCompleteCheckout(tenancyId, endReason);
    const room = await this.rooms.findById(tenancy.roomId);
    if (room.id !== tenancy.roomId || room.operationalState !== 'occupied') {
      throw new BadRequestException('Tenancy checkout requires its matching OCCUPIED Room');
    }

    const endedTenancy = await this.tenancies.completeCheckoutLocal(tenancyId, endReason, occurredAt);
    await this.rooms.transitionOperationalState(tenancy.roomId, 'vacant', 'checkout_confirmed');
    return endedTenancy;
  }

  private async assertActiveAncestry(roomId: string): Promise<{ room: RoomProfile }> {
    const room = await this.rooms.findById(roomId);
    if (room.recordLifecycle !== 'active') {
      throw new BadRequestException('Command requires an active Room');
    }
    const property = await this.properties.findById(room.propertyId);
    if (property.lifecycleStatus !== 'active') {
      throw new BadRequestException('Command requires an active parent Property');
    }
    return { room };
  }

  private assertRequiredListingFields(listing: ListingProfile): void {
    if (!listing.publicTitle.trim() || !listing.publicDescription.trim()) {
      throw new BadRequestException('Listing publish requires public title and description');
    }
  }
}

import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { isNumeric18Scale2NonNegative } from '../../../common/domain/decimal-string';
import {
  CreateListingInput,
  ListingProfile,
  ListingStatus,
  ListingStatusEvent,
  ListingTransitionEventInput,
  UpdateListingContentInput,
} from '../contracts';

const VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ['published', 'archived'],
  published: ['unpublished'],
  unpublished: ['published', 'archived'],
  archived: [],
};

@Injectable()
export class ListingService {
  private readonly listings = new Map<string, ListingProfile>();
  private readonly statusEvents = new Map<string, ListingStatusEvent[]>();

  async createDraft(input: CreateListingInput): Promise<ListingProfile> {
    await this.assertCanCreateCurrent(input.roomId);
    this.assertPrice(input.publicPriceProjection);
    const listing: ListingProfile = {
      id: randomUUID(),
      roomId: input.roomId,
      status: 'draft',
      publicTitle: input.publicTitle,
      publicDescription: input.publicDescription,
      publicPriceProjection: input.publicPriceProjection,
      publicLocationProjection: structuredClone(input.publicLocationProjection),
    };
    this.listings.set(listing.id, structuredClone(listing));
    this.statusEvents.set(listing.id, []);
    return structuredClone(listing);
  }

  async findById(id: string): Promise<ListingProfile> {
    const listing = this.listings.get(id);
    if (!listing) {
      throw new NotFoundException(`Listing not found: ${id}`);
    }
    return structuredClone(listing);
  }

  async findCurrentByRoomId(roomId: string): Promise<ListingProfile | undefined> {
    const listing = Array.from(this.listings.values()).find(
      (candidate) => candidate.roomId === roomId && candidate.status !== 'archived',
    );
    return listing ? structuredClone(listing) : undefined;
  }

  async findPublished(): Promise<ListingProfile[]> {
    return Array.from(this.listings.values())
      .filter((listing) => listing.status === 'published')
      .map((listing) => structuredClone(listing));
  }

  async updateContent(
    id: string,
    input: UpdateListingContentInput,
  ): Promise<ListingProfile> {
    const listing = await this.findById(id);
    if (listing.status === 'archived') {
      throw new BadRequestException('Archived Listing cannot be edited');
    }
    if (input.publicPriceProjection !== undefined) {
      this.assertPrice(input.publicPriceProjection);
    }

    const updated: ListingProfile = {
      ...listing,
      publicTitle: input.publicTitle ?? listing.publicTitle,
      publicDescription: input.publicDescription ?? listing.publicDescription,
      publicPriceProjection: input.publicPriceProjection ?? listing.publicPriceProjection,
      publicLocationProjection: input.publicLocationProjection
        ? structuredClone(input.publicLocationProjection)
        : structuredClone(listing.publicLocationProjection),
    };
    this.listings.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async assertCanCreateCurrent(roomId: string): Promise<void> {
    if (await this.findCurrentByRoomId(roomId)) {
      throw new BadRequestException('Room already has a current non-archived Listing');
    }
  }

  async assertTransition(id: string, next: ListingStatus): Promise<void> {
    const listing = await this.findById(id);
    if (!VALID_TRANSITIONS[listing.status].includes(next)) {
      throw new BadRequestException(`Invalid Listing transition ${listing.status} -> ${next}`);
    }
  }

  async transition(
    id: string,
    next: ListingStatus,
    event: ListingTransitionEventInput,
  ): Promise<ListingProfile> {
    const listing = await this.findById(id);
    await this.assertTransition(id, next);

    const updated: ListingProfile = { ...listing, status: next };
    const statusEvent: ListingStatusEvent = {
      id: randomUUID(),
      listingId: id,
      fromStatus: listing.status,
      toStatus: next,
      reasonCode: event.reasonCode,
      actorType: event.actorType,
      actorUserId: event.actorUserId,
      trigger: event.trigger,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
      metadata: event.metadata ? structuredClone(event.metadata) : undefined,
    };

    this.listings.set(id, structuredClone(updated));
    const events = this.statusEvents.get(id) ?? [];
    events.push(structuredClone(statusEvent));
    this.statusEvents.set(id, events);
    return structuredClone(updated);
  }

  async listStatusEvents(listingId: string): Promise<ListingStatusEvent[]> {
    await this.findById(listingId);
    return (this.statusEvents.get(listingId) ?? []).map((event) => structuredClone(event));
  }

  async archiveAllForRoom(
    roomId: string,
    eventFactory: (listing: ListingProfile) => ListingTransitionEventInput,
  ): Promise<ListingProfile[]> {
    const listing = await this.findCurrentByRoomId(roomId);
    if (!listing) {
      return [];
    }
    if (listing.status === 'published') {
      throw new BadRequestException('Published Listing must be unpublished before archival');
    }
    return [await this.transition(listing.id, 'archived', eventFactory(listing))];
  }

  private assertPrice(value: string): void {
    if (!isNumeric18Scale2NonNegative(value)) {
      throw new BadRequestException('publicPriceProjection must fit non-negative numeric(18,2)');
    }
  }
}

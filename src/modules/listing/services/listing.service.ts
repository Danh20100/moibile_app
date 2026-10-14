import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isNumeric18Scale2NonNegative } from '../../../common/domain/decimal-string';
import type { JsonValue } from '../../../persistence/ports/repositories';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { CreateListingInput, ListingProfile, ListingStatus, ListingStatusEvent, ListingTransitionEventInput, UpdateListingContentInput } from '../contracts';
import { PUBLIC_LISTING_AMENITY_IDS, type ListingAssetDetailsRecord } from '../../../persistence/ports/listing.repository';
import type { ListingAssetDetailsDto } from '../dto';
const VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = { draft: ['published', 'archived'], published: ['unpublished'], unpublished: ['published', 'archived'], archived: [] };
const PUBLIC_AMENITY_IDS = new Set<string>(PUBLIC_LISTING_AMENITY_IDS);
const profile = (row: Awaited<ReturnType<Parameters<Parameters<TransactionManager['run']>[0]>[0]['repositories']['listing']['findListing']>>): ListingProfile | undefined => row ? ({ id: row.listingId, roomId: row.roomId, status: row.status.toLowerCase() as ListingStatus, publicTitle: row.publicTitle, publicDescription: row.publicDescription, publicPriceProjection: row.publicPriceProjection, publicLocationProjection: structuredClone(row.publicLocationProjection) }) : undefined;
@Injectable()
export class ListingService {
  constructor(@Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {}
  async createDraft(input: CreateListingInput): Promise<ListingProfile> { this.assertPrice(input.publicPriceProjection); if (input.id) { const existing = await this.transactions.run(({ repositories }) => repositories.listing.findListing(input.id!)); if (existing) { if (existing.roomId !== input.roomId || existing.status !== 'DRAFT') throw new BadRequestException('Listing request ID already belongs to different data'); if (existing.publicTitle !== input.publicTitle || existing.publicDescription !== input.publicDescription || existing.publicPriceProjection !== input.publicPriceProjection || existing.publicLocationProjection.latitude !== input.publicLocationProjection.latitude || existing.publicLocationProjection.longitude !== input.publicLocationProjection.longitude) throw new BadRequestException('Listing request ID was already used with a different payload'); return profile(existing)!; } } await this.assertCanCreateCurrent(input.roomId); const value: ListingProfile = { id: input.id ?? randomUUID(), roomId: input.roomId, status: 'draft', publicTitle: input.publicTitle, publicDescription: input.publicDescription, publicPriceProjection: input.publicPriceProjection, publicLocationProjection: structuredClone(input.publicLocationProjection) }; await this.transactions.run(({ repositories }) => repositories.listing.createListing({ listingId: value.id, roomId: value.roomId, status: 'DRAFT', publicTitle: value.publicTitle, publicDescription: value.publicDescription, publicPriceProjection: value.publicPriceProjection, publicLocationProjection: value.publicLocationProjection })); const committed = await this.transactions.run(({ repositories }) => repositories.listing.findListing(value.id)); if (!committed || committed.roomId !== value.roomId || committed.status !== 'DRAFT' || committed.publicTitle !== value.publicTitle || committed.publicDescription !== value.publicDescription || committed.publicPriceProjection !== value.publicPriceProjection || committed.publicLocationProjection.latitude !== value.publicLocationProjection.latitude || committed.publicLocationProjection.longitude !== value.publicLocationProjection.longitude) throw new BadRequestException('Listing request ID was already used with a different payload'); return profile(committed)!; }
  async findById(id: string): Promise<ListingProfile> { const value = profile(await this.transactions.run(({ repositories }) => repositories.listing.findListing(id))); if (!value) throw new NotFoundException(`Listing not found: ${id}`); return value; }
  async findAssetDetails(id: string): Promise<ListingAssetDetailsRecord> {
    const row = await this.transactions.run(({ repositories }) => repositories.listing.findAssetDetails(id));
    if (!row) throw new NotFoundException(`Asset details not found for Listing: ${id}`);
    return row;
  }
  async findPublicAmenityIds(id: string): Promise<string[]> {
    return this.transactions.run(async ({ repositories }) => {
      const listing = await repositories.listing.findListing(id);
      if (!listing || listing.status !== 'PUBLISHED') return [];
      const details = await repositories.listing.findAssetDetails(id);
      return (details?.amenityIds ?? []).filter((amenityId) => PUBLIC_AMENITY_IDS.has(amenityId));
    });
  }
  async saveAssetDetails(id: string, input: ListingAssetDetailsDto): Promise<ListingAssetDetailsRecord> {
    if (input.amenityIds.some((value) => !PUBLIC_AMENITY_IDS.has(value))) throw new BadRequestException('Unknown amenity ID');
    return this.transactions.run(async ({ repositories }) => {
      const listing = await repositories.listing.findListing(id);
      if (!listing) throw new NotFoundException(`Listing not found: ${id}`);
      if (listing.status === 'PUBLISHED' || listing.status === 'ARCHIVED') throw new BadRequestException('Unpublish the Listing before editing its Asset details');
      const room = await repositories.property.findRoom(listing.roomId);
      if (!room) throw new NotFoundException(`Room not found for Listing: ${id}`);
      if (input.managementStatus === 'ACTIVE') {
        const property = await repositories.property.findProperty(room.propertyId);
        if (!input.assetType?.trim() || !input.publicAreaLabel?.trim() || !input.areaSquareMeters ||
            Number(input.areaSquareMeters) <= 0 || input.advertisedDeposit === undefined || input.advertisedDeposit === null ||
            room.nameOrLabel.trim() === '' || !property?.operationalAddressText.trim() ||
            !isNumeric18Scale2NonNegative(listing.publicPriceProjection) || Number(listing.publicPriceProjection) <= 0) {
          throw new BadRequestException('Complete the required Asset details before activating it');
        }
        if (room.recordLifecycle !== 'ACTIVE' || property.lifecycleStatus !== 'ACTIVE') throw new BadRequestException('Archived Property or Room cannot be activated');
      }
      const record: ListingAssetDetailsRecord = {
        listingId: id, managementStatus: input.managementStatus, assetType: input.assetType ?? null,
        publicAreaLabel: input.publicAreaLabel ?? null, areaSquareMeters: input.areaSquareMeters ?? null,
        advertisedDeposit: input.advertisedDeposit ?? null, bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null, furnishing: input.furnishing ?? null,
        amenityIds: [...input.amenityIds], rules: [...input.rules],
        electricityOffer: input.electricityOffer ?? null, waterOffer: input.waterOffer ?? null,
        serviceOffer: input.serviceOffer ?? null, minimumTermMonths: input.minimumTermMonths ?? null,
        availableFrom: input.availableFrom ?? null, bathroomArrangement: input.bathroomArrangement ?? null,
        maxOccupants: input.maxOccupants ?? null, floorLabel: input.floorLabel ?? null,
      };
      await repositories.listing.saveAssetDetails(record);
      return record;
    });
  }
  async findCurrentByRoomId(roomId: string): Promise<ListingProfile | undefined> { return profile(await this.transactions.run(({ repositories }) => repositories.listing.findCurrentListingByRoom(roomId))); }
  async findByRoomId(roomId: string): Promise<ListingProfile[]> { return (await this.transactions.run(({ repositories }) => repositories.listing.findListingsByRoom(roomId))).map((row) => profile(row)!); }
  async findPublished(): Promise<ListingProfile[]> { return (await this.transactions.run(({ repositories }) => repositories.listing.findPublishedListings())).map((row) => profile(row)!); }
  async updateContent(id: string, input: UpdateListingContentInput): Promise<ListingProfile> { if (input.publicPriceProjection !== undefined) this.assertPrice(input.publicPriceProjection); return this.transactions.run(async ({ repositories }) => { const row = await repositories.listing.findListing(id); if (!row) throw new NotFoundException(`Listing not found: ${id}`); if (row.status === 'ARCHIVED') throw new BadRequestException('Archived Listing cannot be edited'); const updated = { ...row, publicTitle: input.publicTitle ?? row.publicTitle, publicDescription: input.publicDescription ?? row.publicDescription, publicPriceProjection: input.publicPriceProjection ?? row.publicPriceProjection, publicLocationProjection: input.publicLocationProjection ?? row.publicLocationProjection }; await repositories.listing.updateListing(updated); return profile(updated)!; }); }
  async assertCanCreateCurrent(roomId: string): Promise<void> { if (await this.findCurrentByRoomId(roomId)) throw new BadRequestException('Room already has a current non-archived Listing'); }
  async assertTransition(id: string, next: ListingStatus): Promise<void> { const value = await this.findById(id); if (!VALID_TRANSITIONS[value.status].includes(next)) throw new BadRequestException(`Invalid Listing transition ${value.status} -> ${next}`); }
  async assertAssetDetailsReadyToPublish(id: string): Promise<void> {
    const result = await this.transactions.run(async ({ repositories }) => ({
      listing: await repositories.listing.findListing(id),
      details: await repositories.listing.findAssetDetails(id),
    }));
    if (!result.listing) throw new NotFoundException(`Listing not found: ${id}`);
    // Listings created before the additive details table keep their existing lifecycle contract.
    if (!result.details) return;
    if (result.details.managementStatus !== 'ACTIVE' || !result.details.assetType?.trim() ||
        !result.details.publicAreaLabel?.trim() || !result.details.areaSquareMeters ||
        Number(result.details.areaSquareMeters) <= 0 || result.details.advertisedDeposit === null ||
        Number(result.listing.publicPriceProjection) <= 0) {
      throw new BadRequestException('Complete and activate Asset details before publishing this Listing');
    }
  }
  async transition(id: string, next: ListingStatus, event: ListingTransitionEventInput): Promise<ListingProfile> { return this.transactions.run(async ({ repositories }) => { const row = await repositories.listing.findListing(id); if (!row) throw new NotFoundException(`Listing not found: ${id}`); const current = row.status.toLowerCase() as ListingStatus; if (!VALID_TRANSITIONS[current].includes(next)) throw new BadRequestException(`Invalid Listing transition ${current} -> ${next}`); const updated = { ...row, status: next.toUpperCase() }; await repositories.listing.updateListing(updated); await repositories.listing.insertStatusEvent({ listingStatusEventId: randomUUID(), listingId: id, fromStatus: row.status, toStatus: updated.status, reasonCode: event.reasonCode, actorType: event.actorType, actorUserId: event.actorUserId ?? null, trigger: event.trigger, occurredAt: event.occurredAt ?? new Date().toISOString(), metadata: event.metadata as JsonValue ?? null }); return profile(updated)!; }); }
  async listStatusEvents(listingId: string): Promise<ListingStatusEvent[]> { await this.findById(listingId); return (await this.transactions.run(({ repositories }) => repositories.listing.findStatusEvents(listingId))).map((row) => ({ id: row.listingStatusEventId, listingId: row.listingId, fromStatus: row.fromStatus.toLowerCase() as ListingStatus, toStatus: row.toStatus.toLowerCase() as ListingStatus, reasonCode: row.reasonCode, actorType: row.actorType, actorUserId: row.actorUserId ?? undefined, trigger: row.trigger, occurredAt: row.occurredAt, metadata: row.metadata as Record<string, unknown> ?? undefined })); }
  async archiveAllForRoom(roomId: string, eventFactory: (listing: ListingProfile) => ListingTransitionEventInput): Promise<ListingProfile[]> { const value = await this.findCurrentByRoomId(roomId); if (!value) return []; if (value.status === 'published') throw new BadRequestException('Published Listing must be unpublished before archival'); return [await this.transition(value.id, 'archived', eventFactory(value))]; }
  private assertPrice(value: string): void { if (!isNumeric18Scale2NonNegative(value)) throw new BadRequestException('publicPriceProjection must fit non-negative numeric(18,2)'); }
}

import { sql, type Kysely, type Transaction } from 'kysely';

import type { CreateInquiryInput, CreateListingInput, CreateListingStatusEventInput, InquiryRecord, ListingAssetDetailsRecord, ListingRecord, ListingRepository, ListingStatusEventRecord } from '../../../persistence/ports/listing.repository';
import { geoPoint, geographyLatitude, geographyLongitude, geographyPoint } from '../postgis';
import { mapPostgresError } from '../postgres-error.mapper';
import type { Database } from '../schema.types';

export class PostgresListingRepository implements ListingRepository {
  constructor(private readonly executor: Kysely<Database> | Transaction<Database>) {}

  async createListing(input: CreateListingInput): Promise<void> {
    try {
      await this.executor.insertInto('listings').values({
        listing_id: input.listingId, room_id: input.roomId, status: input.status,
        public_title: input.publicTitle, public_description: input.publicDescription,
        public_price_projection: input.publicPriceProjection,
        public_location_projection: geographyPoint(input.publicLocationProjection),
      }).onConflict((oc) => oc.column('listing_id').doNothing()).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findListing(listingId: string): Promise<ListingRecord | undefined> {
    return this.findListingWhere('listing_id', listingId);
  }

  async findAssetDetails(listingId: string): Promise<ListingAssetDetailsRecord | undefined> {
    try {
      const row = await this.executor.selectFrom('listing_asset_details').selectAll()
        .where('listing_id', '=', listingId).executeTakeFirst();
      return row ? {
        listingId: row.listing_id, managementStatus: row.management_status,
        assetType: row.asset_type, publicAreaLabel: row.public_area_label,
        areaSquareMeters: row.area_square_meters, advertisedDeposit: row.advertised_deposit,
        bedrooms: row.bedrooms, bathrooms: row.bathrooms, furnishing: row.furnishing,
        amenityIds: [...row.amenity_ids], rules: [...row.rules],
        electricityOffer: row.electricity_offer, waterOffer: row.water_offer,
        serviceOffer: row.service_offer, minimumTermMonths: row.minimum_term_months,
        availableFrom: row.available_from, bathroomArrangement: row.bathroom_arrangement,
        maxOccupants: row.max_occupants, floorLabel: row.floor_label,
      } : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async saveAssetDetails(input: ListingAssetDetailsRecord): Promise<void> {
    try {
      await this.executor.insertInto('listing_asset_details').values({
        listing_id: input.listingId, management_status: input.managementStatus,
        asset_type: input.assetType, public_area_label: input.publicAreaLabel,
        area_square_meters: input.areaSquareMeters, advertised_deposit: input.advertisedDeposit,
        bedrooms: input.bedrooms, bathrooms: input.bathrooms, furnishing: input.furnishing,
        amenity_ids: input.amenityIds, rules: input.rules, electricity_offer: input.electricityOffer,
        water_offer: input.waterOffer, service_offer: input.serviceOffer,
        minimum_term_months: input.minimumTermMonths, available_from: input.availableFrom,
        bathroom_arrangement: input.bathroomArrangement, max_occupants: input.maxOccupants,
        floor_label: input.floorLabel,
      }).onConflict((oc) => oc.column('listing_id').doUpdateSet({
        management_status: input.managementStatus, asset_type: input.assetType,
        public_area_label: input.publicAreaLabel, area_square_meters: input.areaSquareMeters,
        advertised_deposit: input.advertisedDeposit, bedrooms: input.bedrooms,
        bathrooms: input.bathrooms, furnishing: input.furnishing,
        amenity_ids: input.amenityIds, rules: input.rules,
        electricity_offer: input.electricityOffer, water_offer: input.waterOffer,
        service_offer: input.serviceOffer, minimum_term_months: input.minimumTermMonths,
        available_from: input.availableFrom, bathroom_arrangement: input.bathroomArrangement,
        max_occupants: input.maxOccupants, floor_label: input.floorLabel,
      })).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findCurrentListingByRoom(roomId: string): Promise<ListingRecord | undefined> {
    try {
      const row = await this.listingSelect().where('room_id', '=', roomId)
        .where('status', '<>', 'ARCHIVED').executeTakeFirst();
      return row ? this.mapListing(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findListingsByRoom(roomId: string): Promise<ListingRecord[]> {
    try {
      return (await this.listingSelect().where('room_id', '=', roomId).orderBy('listing_id').execute())
        .map((row) => this.mapListing(row));
    } catch (error) { throw mapPostgresError(error); }
  }

  async findPublishedListings(): Promise<ListingRecord[]> {
    try { return (await this.listingSelect().where('status', '=', 'PUBLISHED').orderBy('listing_id').execute()).map((row) => this.mapListing(row)); }
    catch (error) { throw mapPostgresError(error); }
  }

  async lockListing(listingId: string): Promise<void> {
    try {
      await this.executor
        .selectFrom('listings')
        .select('listing_id')
        .where('listing_id', '=', listingId)
        .forUpdate()
        .executeTakeFirst();
    } catch (error) {
      throw mapPostgresError(error);
    }
  }

  async updateListing(record: ListingRecord): Promise<void> {
    try {
      await this.executor.updateTable('listings').set({
        room_id: record.roomId, status: record.status, public_title: record.publicTitle,
        public_description: record.publicDescription, public_price_projection: record.publicPriceProjection,
        public_location_projection: geographyPoint(record.publicLocationProjection),
      }).where('listing_id', '=', record.listingId).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async insertStatusEvent(input: CreateListingStatusEventInput): Promise<void> {
    try {
      await this.executor.insertInto('listing_status_events').values({
        listing_status_event_id: input.listingStatusEventId, listing_id: input.listingId,
        from_status: input.fromStatus, to_status: input.toStatus, reason_code: input.reasonCode,
        actor_type: input.actorType, actor_user_id: input.actorUserId, trigger: input.trigger,
        occurred_at: input.occurredAt, metadata: input.metadata,
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findStatusEvents(listingId: string): Promise<ListingStatusEventRecord[]> {
    try { return [...(await sql<ListingStatusEventRecord>`SELECT listing_status_event_id AS "listingStatusEventId",listing_id AS "listingId",from_status AS "fromStatus",to_status AS "toStatus",reason_code AS "reasonCode",actor_type AS "actorType",actor_user_id AS "actorUserId",trigger,occurred_at AS "occurredAt",metadata FROM listing_status_events WHERE listing_id=${listingId} ORDER BY occurred_at,listing_status_event_id`.execute(this.executor)).rows]; }
    catch (error) { throw mapPostgresError(error); }
  }

  async createInquiry(input: CreateInquiryInput): Promise<void> {
    try {
      await this.executor.insertInto('inquiries').values({
        inquiry_id: input.inquiryId, listing_id: input.listingId, sender_user_id: input.senderUserId,
        contact_intent_or_message: input.contactIntentOrMessage, status: input.status, created_at: input.createdAt,
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findInquiry(inquiryId: string): Promise<InquiryRecord | undefined> {
    try {
      const row = await this.executor.selectFrom('inquiries')
        .select(['inquiry_id', 'listing_id', 'sender_user_id', 'contact_intent_or_message', 'status', 'created_at'])
        .where('inquiry_id', '=', inquiryId).executeTakeFirst();
      return row ? {
        inquiryId: row.inquiry_id, listingId: row.listing_id, senderUserId: row.sender_user_id,
        contactIntentOrMessage: row.contact_intent_or_message, status: row.status, createdAt: row.created_at,
      } : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findInquiriesByListing(listingId: string): Promise<InquiryRecord[]> {
    try { return [...(await sql<InquiryRecord>`SELECT inquiry_id AS "inquiryId",listing_id AS "listingId",sender_user_id AS "senderUserId",contact_intent_or_message AS "contactIntentOrMessage",status,created_at AS "createdAt" FROM inquiries WHERE listing_id=${listingId} ORDER BY created_at,inquiry_id`.execute(this.executor)).rows]; }
    catch (error) { throw mapPostgresError(error); }
  }

  private listingSelect() {
    return this.executor.selectFrom('listings').select([
      'listing_id', 'room_id', 'status', 'public_title', 'public_description', 'public_price_projection',
      geographyLongitude('listings.public_location_projection').as('public_longitude'),
      geographyLatitude('listings.public_location_projection').as('public_latitude'),
    ]);
  }

  private async findListingWhere(column: 'listing_id', value: string): Promise<ListingRecord | undefined> {
    try {
      const row = await this.listingSelect().where(column, '=', value).executeTakeFirst();
      return row ? this.mapListing(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  private mapListing(row: {
    listing_id: string; room_id: string; status: string; public_title: string;
    public_description: string; public_price_projection: string;
    public_longitude: number; public_latitude: number;
  }): ListingRecord {
    return {
      listingId: row.listing_id, roomId: row.room_id, status: row.status,
      publicTitle: row.public_title, publicDescription: row.public_description,
      publicPriceProjection: row.public_price_projection,
      publicLocationProjection: geoPoint(row.public_longitude, row.public_latitude),
    };
  }
}

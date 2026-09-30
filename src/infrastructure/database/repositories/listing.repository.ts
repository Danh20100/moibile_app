import { sql, type Kysely, type Transaction } from 'kysely';

import type { CreateInquiryInput, CreateListingInput, CreateListingStatusEventInput, InquiryRecord, ListingRecord, ListingRepository, ListingStatusEventRecord } from '../../../persistence/ports/listing.repository';
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
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findListing(listingId: string): Promise<ListingRecord | undefined> {
    return this.findListingWhere('listing_id', listingId);
  }

  async findCurrentListingByRoom(roomId: string): Promise<ListingRecord | undefined> {
    try {
      const row = await this.listingSelect().where('room_id', '=', roomId)
        .where('status', '<>', 'ARCHIVED').executeTakeFirst();
      return row ? this.mapListing(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findPublishedListings(): Promise<ListingRecord[]> {
    try { return (await this.listingSelect().where('status', '=', 'PUBLISHED').orderBy('listing_id').execute()).map((row) => this.mapListing(row)); }
    catch (error) { throw mapPostgresError(error); }
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

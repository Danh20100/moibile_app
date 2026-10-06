import type { GeoPoint } from './geography';
import type { DecimalString, JsonValue, TimestampString } from './repositories';

export interface ListingRecord {
  listingId: string; roomId: string; status: string; publicTitle: string; publicDescription: string;
  publicPriceProjection: DecimalString; publicLocationProjection: GeoPoint;
}
export interface ListingStatusEventRecord {
  listingStatusEventId: string; listingId: string; fromStatus: string; toStatus: string;
  reasonCode: string; actorType: string; actorUserId: string | null; trigger: string;
  occurredAt: TimestampString; metadata: JsonValue | null;
}
export interface InquiryRecord {
  inquiryId: string; listingId: string; senderUserId: string | null;
  contactIntentOrMessage: string; status: string; createdAt: TimestampString;
}
export type CreateListingInput = ListingRecord;
export type CreateListingStatusEventInput = ListingStatusEventRecord;
export type CreateInquiryInput = InquiryRecord;
export interface ListingRepository {
  createListing(input: CreateListingInput): Promise<void>;
  findListing(listingId: string): Promise<ListingRecord | undefined>;
  findCurrentListingByRoom(roomId: string): Promise<ListingRecord | undefined>;
  findListingsByRoom(roomId: string): Promise<ListingRecord[]>;
  findPublishedListings(): Promise<ListingRecord[]>;
  lockListing(listingId: string): Promise<void>;
  updateListing(record: ListingRecord): Promise<void>;
  insertStatusEvent(input: CreateListingStatusEventInput): Promise<void>;
  findStatusEvents(listingId: string): Promise<ListingStatusEventRecord[]>;
  createInquiry(input: CreateInquiryInput): Promise<void>;
  findInquiry(inquiryId: string): Promise<InquiryRecord | undefined>;
  findInquiriesByListing(listingId: string): Promise<InquiryRecord[]>;
}

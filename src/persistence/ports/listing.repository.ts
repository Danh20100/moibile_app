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
export interface CreateListingInput extends ListingRecord {}
export interface CreateListingStatusEventInput extends ListingStatusEventRecord {}
export interface CreateInquiryInput extends InquiryRecord {}
export interface ListingRepository {
  createListing(input: CreateListingInput): Promise<void>;
  findListing(listingId: string): Promise<ListingRecord | undefined>;
  findCurrentListingByRoom(roomId: string): Promise<ListingRecord | undefined>;
  updateListing(record: ListingRecord): Promise<void>;
  insertStatusEvent(input: CreateListingStatusEventInput): Promise<void>;
  createInquiry(input: CreateInquiryInput): Promise<void>;
  findInquiry(inquiryId: string): Promise<InquiryRecord | undefined>;
}

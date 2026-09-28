import type { GeoPoint } from './geography';
import type { DecimalString, JsonValue, TimestampString } from './repositories';

export interface ListingRecord {
  listing_id: string; room_id: string; status: string; public_title: string; public_description: string;
  public_price_projection: DecimalString; public_location_projection: GeoPoint;
}
export interface ListingStatusEventRecord {
  listing_status_event_id: string; listing_id: string; from_status: string; to_status: string;
  reason_code: string; actor_type: string; actor_user_id: string | null; trigger: string;
  occurred_at: TimestampString; metadata: JsonValue | null;
}
export interface InquiryRecord {
  inquiry_id: string; listing_id: string; sender_user_id: string | null;
  contact_intent_or_message: string; status: string; created_at: TimestampString;
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

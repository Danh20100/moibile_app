import type { GeoPoint } from './geography';
import type { DecimalString, JsonValue, TimestampString } from './repositories';

export const PUBLIC_LISTING_AMENITY_IDS = [
  'wifi', 'air_conditioning', 'washing_machine', 'kitchen', 'private_bathroom',
  'balcony', 'parking', 'elevator', 'security_camera',
] as const;

export interface ListingRecord {
  listingId: string; roomId: string; status: string; publicTitle: string; publicDescription: string;
  publicPriceProjection: DecimalString; publicLocationProjection: GeoPoint;
}
export interface ListingAssetDetailsRecord {
  listingId: string; managementStatus: 'DRAFT' | 'ACTIVE'; assetType: string | null;
  publicAreaLabel: string | null; areaSquareMeters: string | null; advertisedDeposit: string | null;
  bedrooms: number | null; bathrooms: number | null; furnishing: string | null;
  amenityIds: string[]; rules: string[]; electricityOffer: string | null; waterOffer: string | null;
  serviceOffer: string | null; minimumTermMonths: number | null; availableFrom: string | null;
  bathroomArrangement: 'PRIVATE' | 'SHARED' | null; maxOccupants: number | null; floorLabel: string | null;
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
  findAssetDetails(listingId: string): Promise<ListingAssetDetailsRecord | undefined>;
  saveAssetDetails(input: ListingAssetDetailsRecord): Promise<void>;
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

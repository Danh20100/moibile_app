import type { DecimalString } from '../../../common/domain/decimal-string';
import type { GeoPoint } from '../../property/contracts';

export type ListingStatus = 'draft' | 'published' | 'unpublished' | 'archived';

export interface ListingReference {
  listingId: string;
}

export interface ListingProfile {
  id: string;
  roomId: string;
  status: ListingStatus;
  publicTitle: string;
  publicDescription: string;
  publicPriceProjection: DecimalString;
  publicLocationProjection: GeoPoint;
}

export interface ListingStatusEvent {
  id: string;
  listingId: string;
  fromStatus: ListingStatus;
  toStatus: ListingStatus;
  reasonCode: string;
  actorType: string;
  actorUserId?: string;
  trigger: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}
export interface CreateListingInput {
  id?: string;
  roomId: string;
  publicTitle: string;
  publicDescription: string;
  publicPriceProjection: DecimalString;
  publicLocationProjection: GeoPoint;
}

export interface UpdateListingContentInput {
  publicTitle?: string;
  publicDescription?: string;
  publicPriceProjection?: DecimalString;
  publicLocationProjection?: GeoPoint;
}

export interface ListingTransitionEventInput {
  reasonCode: string;
  actorType: string;
  actorUserId?: string;
  trigger: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Inquiry {
  id: string;
  listingId: string;
  senderUserId?: string;
  contactIntentOrMessage: string;
  status: string;
  createdAt: string;
}

export interface CreateInquiryInput {
  listingId: string;
  senderUserId?: string;
  contactIntentOrMessage: string;
  status: string;
}

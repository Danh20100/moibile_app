import type { GeoPoint } from './geography';
import type { DecimalString } from './repositories';

export interface PublishedListingSearchResult {
  listingId: string;
  roomId: string;
  publicTitle: string;
  publicDescription: string;
  publicPriceProjection: DecimalString;
  publicLocation: GeoPoint;
  distanceMeters: number;
}

export interface ListingSearchRepository {
  findPublishedWithinRadius(
    center: GeoPoint,
    radiusMeters: number,
    minPrice?: DecimalString,
    maxPrice?: DecimalString,
  ): Promise<PublishedListingSearchResult[]>;
}

export const LISTING_SEARCH_REPOSITORY = Symbol('LISTING_SEARCH_REPOSITORY');

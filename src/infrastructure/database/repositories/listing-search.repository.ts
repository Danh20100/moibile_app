import { sql, type Kysely, type Transaction } from 'kysely';

import type { GeoPoint } from '../../../persistence/ports/geography';
import { PUBLIC_LISTING_AMENITY_IDS } from '../../../persistence/ports/listing.repository';
import type {
  ListingSearchRepository,
  PublishedListingSearchResult,
} from '../../../persistence/ports/listing-search.repository';
import type { DecimalString } from '../../../persistence/ports/repositories';
import type { Database } from '../schema.types';

export class PostgresListingSearchRepository implements ListingSearchRepository {
  constructor(private readonly db: Kysely<Database> | Transaction<Database>) {}

  async findPublishedWithinRadius(
    center: GeoPoint,
    radiusMeters: number,
    minPrice?: DecimalString,
    maxPrice?: DecimalString,
  ): Promise<PublishedListingSearchResult[]> {
    if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
      throw new RangeError('radiusMeters must be finite and nonnegative');
    }
    const point = sql`ST_SetSRID(ST_MakePoint(${center.longitude},${center.latitude}),4326)::geography`;
    const result = await sql<PublishedListingSearchResult>`
      SELECT
        listing_id AS "listingId",
        room_id AS "roomId",
        public_title AS "publicTitle",
        public_description AS "publicDescription",
        public_price_projection AS "publicPriceProjection",
        json_build_object(
          'longitude', ST_X(public_location_projection::geometry),
          'latitude', ST_Y(public_location_projection::geometry)
        ) AS "publicLocation",
        ARRAY(
          SELECT media_id FROM listing_asset_media
          WHERE listing_id = listings.listing_id AND public_approved = true
          ORDER BY position
        ) AS "publicPhotoIds",
        ARRAY(
          SELECT amenity_id
          FROM listing_asset_details,
               unnest(amenity_ids) WITH ORDINALITY AS amenities(amenity_id, amenity_position)
          WHERE listing_id = listings.listing_id
            AND amenity_id = ANY(${[...PUBLIC_LISTING_AMENITY_IDS]}::text[])
          ORDER BY amenity_position
        ) AS "publicAmenityIds",
        ST_Distance(public_location_projection, ${point})::float8 AS "distanceMeters"
      FROM listings
      WHERE status = 'PUBLISHED'
        AND ST_DWithin(public_location_projection, ${point}, ${radiusMeters})
        AND (${minPrice ?? null}::numeric IS NULL OR public_price_projection >= ${minPrice ?? null}::numeric)
        AND (${maxPrice ?? null}::numeric IS NULL OR public_price_projection <= ${maxPrice ?? null}::numeric)
      ORDER BY "distanceMeters", listing_id
    `.execute(this.db);
    return [...result.rows];
  }
}

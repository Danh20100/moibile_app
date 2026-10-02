import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { isNumeric18Scale2NonNegative } from '../../../common/domain/decimal-string';
import {
  LISTING_SEARCH_REPOSITORY,
  type ListingSearchRepository,
  type PublishedListingSearchResult,
} from '../../../persistence/ports/listing-search.repository';
import type { PublicListingSearchQueryDto } from '../dto/public-listing-search.dto';

function moneyCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

@Injectable()
export class ListingSearchService {
  constructor(
    @Inject(LISTING_SEARCH_REPOSITORY)
    private readonly search: ListingSearchRepository,
  ) {}

  async findPublic(query: PublicListingSearchQueryDto): Promise<PublishedListingSearchResult[]> {
    if (!Number.isFinite(query.radiusMeters) || query.radiusMeters < 0) {
      throw new BadRequestException('radiusMeters must be finite and non-negative');
    }
    for (const [name, value] of [['minPrice', query.minPrice], ['maxPrice', query.maxPrice]] as const) {
      if (value !== undefined && !isNumeric18Scale2NonNegative(value)) {
        throw new BadRequestException(`${name} must fit non-negative numeric(18,2)`);
      }
    }
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      if (moneyCents(query.minPrice) > moneyCents(query.maxPrice)) {
        throw new BadRequestException('minPrice must not exceed maxPrice');
      }
    }
    return this.search.findPublishedWithinRadius(
      { latitude: query.latitude, longitude: query.longitude },
      query.radiusMeters,
      query.minPrice,
      query.maxPrice,
    );
  }
}

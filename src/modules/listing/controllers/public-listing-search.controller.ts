import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../common';
import type { PublishedListingSearchResult } from '../../../persistence/ports/listing-search.repository';
import { PublicListingSearchQueryDto, PublicListingSearchResultDto } from '../dto/public-listing-search.dto';
import { ListingSearchService } from '../services/listing-search.service';

@ApiTags('Listing')
@Controller('listings/public/search')
export class PublicListingSearchController {
  constructor(@Inject(ListingSearchService) private readonly search: ListingSearchService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Search PUBLISHED Listings by public projection radius and frozen price-range filters',
    description:
      'Uses only Listing publicLocationProjection. Exact operational Property location is never returned. Room/property type remains OPEN and is not exposed here.',
  })
  @ApiResponse({ status: 200, type: [PublicListingSearchResultDto] })
  async find(@Query() query: PublicListingSearchQueryDto): Promise<PublishedListingSearchResult[]> {
    return this.search.findPublic(query);
  }
}

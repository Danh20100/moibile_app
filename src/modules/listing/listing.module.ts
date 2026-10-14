import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { DATABASE_CLIENT } from '../../infrastructure/database/database.tokens';
import { ObjectStorageModule } from '../../infrastructure/object-storage/object-storage.module';
import { PostgresListingSearchRepository } from '../../infrastructure/database/repositories/listing-search.repository';
import type { Database } from '../../infrastructure/database/schema.types';
import { LISTING_SEARCH_REPOSITORY } from '../../persistence/ports/listing-search.repository';

import { InquiryController } from './controllers/inquiry.controller';
import { ListingController } from './controllers/listing.controller';
import { PublicListingSearchController } from './controllers/public-listing-search.controller';
import { InquiryService } from './services/inquiry.service';
import { ListingSearchService } from './services/listing-search.service';
import { ListingService } from './services/listing.service';
import { ListingAssetMediaService } from './services/listing-asset-media.service';

@Module({
  imports: [DatabaseModule, ObjectStorageModule],
  controllers: [ListingController, InquiryController, PublicListingSearchController],
  providers: [
    ListingService,
    ListingAssetMediaService,
    InquiryService,
    ListingSearchService,
    {
      provide: LISTING_SEARCH_REPOSITORY,
      inject: [DATABASE_CLIENT],
      useFactory: (database: Kysely<Database>) => new PostgresListingSearchRepository(database),
    },
  ],
  exports: [ListingService, InquiryService, ListingSearchService],
})
export class ListingModule {}

import { Module } from '@nestjs/common';

import { InquiryController } from './controllers/inquiry.controller';
import { ListingController } from './controllers/listing.controller';
import { InquiryService } from './services/inquiry.service';
import { ListingService } from './services/listing.service';

@Module({
  controllers: [ListingController, InquiryController],
  providers: [ListingService, InquiryService],
  exports: [ListingService, InquiryService],
})
export class ListingModule {}

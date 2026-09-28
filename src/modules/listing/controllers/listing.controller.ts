import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../common';
import { ListingProfile } from '../contracts';
import { ListingTransitionContextDto, UpdateListingDto } from '../dto';
import { ListingService } from '../services/listing.service';

@ApiTags('Listing')
@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Read currently published Listing projections' })
  async findPublic(): Promise<ListingProfile[]> {
    return this.listingService.findPublished();
  }

  @Get(':id')
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findById(@Param('id') id: string): Promise<ListingProfile> {
    return this.listingService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateListingDto): Promise<ListingProfile> {
    return this.listingService.updateContent(id, dto);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Explicitly unpublish a currently published Listing' })
  async unpublish(
    @Param('id') id: string,
    @Body() dto: ListingTransitionContextDto,
  ): Promise<ListingProfile> {
    return this.listingService.transition(id, 'unpublished', dto);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive an eligible draft or unpublished Listing' })
  async archive(
    @Param('id') id: string,
    @Body() dto: ListingTransitionContextDto,
  ): Promise<ListingProfile> {
    return this.listingService.transition(id, 'archived', dto);
  }
}

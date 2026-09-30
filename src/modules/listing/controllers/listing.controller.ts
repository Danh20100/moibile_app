import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../common';
import type { ListingProfile } from '../contracts';
import { ListingProfileDto, ListingTransitionContextDto, UpdateListingDto } from '../dto';
import { ListingService } from '../services/listing.service';

@ApiTags('Listing')
@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Read currently published Listing projections' })
  @ApiResponse({ status: 200, description: 'Published listings', type: [ListingProfileDto] })
  async findPublic(): Promise<ListingProfile[]> {
    return this.listingService.findPublished();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Listing by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'Listing details', type: ListingProfileDto })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findById(@Param('id') id: string): Promise<ListingProfile> {
    return this.listingService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Listing content' })
  @ApiParam({ name: 'id', type: String, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'Updated listing', type: ListingProfileDto })
  async update(@Param('id') id: string, @Body() dto: UpdateListingDto): Promise<ListingProfile> {
    return this.listingService.updateContent(id, dto);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Explicitly unpublish a currently published Listing' })
  @ApiParam({ name: 'id', type: String, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'Unpublished listing', type: ListingProfileDto })
  async unpublish(
    @Param('id') id: string,
    @Body() dto: ListingTransitionContextDto,
  ): Promise<ListingProfile> {
    return this.listingService.transition(id, 'unpublished', dto);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive an eligible draft or unpublished Listing' })
  @ApiParam({ name: 'id', type: String, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'Archived listing', type: ListingProfileDto })
  async archive(
    @Param('id') id: string,
    @Body() dto: ListingTransitionContextDto,
  ): Promise<ListingProfile> {
    return this.listingService.transition(id, 'archived', dto);
  }
}

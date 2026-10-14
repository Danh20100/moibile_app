import { BadRequestException, Body, Controller, Delete, Get, Header, Inject, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { ListingProfile, ListingTransitionEventInput } from '../contracts';
import { ListingAssetDetailsDto, ListingAssetDetailsProfileDto, ListingProfileDto, UpdateListingDto } from '../dto';
import { ReorderListingAssetMediaDto, SetListingAssetMediaPublicDto, UploadListingAssetMediaDto } from '../dto/listing-asset-media.dto';
import { ListingAssetMediaService } from '../services/listing-asset-media.service';
import { ListingService } from '../services/listing.service';

@ApiTags('Listing')
@Controller('listings')
export class ListingController {
  constructor(
    @Inject(ListingService)
    private readonly listingService: ListingService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
    @Inject(ListingAssetMediaService)
    private readonly media: ListingAssetMediaService,
  ) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Read currently published Listing projections' })
  @ApiResponse({ status: 200, description: 'Published listings', type: [ListingProfileDto] })
  async findPublic(): Promise<(ListingProfile & { publicPhotoIds: string[] })[]> {
    const listings = await this.listingService.findPublished();
    return Promise.all(listings.map(async (listing) => ({ ...listing, publicPhotoIds: await this.media.publicIds(listing.id) })));
  }

  @Public()
  @Get('public/:id/media/:mediaId/content')
  @Header('Cache-Control', 'no-store')
  async publicAssetMediaContent(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.media.publicContent(id, mediaId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the current non-archived Listing for an operated Room' })
  @ApiQuery({ name: 'roomId', type: String, required: true, description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Current Listing for the Room', type: ListingProfileDto })
  @ApiResponse({ status: 400, description: 'roomId query parameter is required' })
  @ApiResponse({ status: 403, description: 'Current user does not operate the Room' })
  @ApiResponse({ status: 404, description: 'Room or current Listing not found' })
  async findCurrentByRoomId(
    @Query('roomId') roomId: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ListingProfile> {
    if (!roomId?.trim()) {
      throw new BadRequestException('roomId query parameter is required');
    }
    if (user) {
      await this.authz.assertOperatesRoom(user.userId, roomId);
    }
    const listing = await this.listingService.findCurrentByRoomId(roomId);
    if (!listing) {
      throw new NotFoundException(`Current Listing not found for Room: ${roomId}`);
    }
    return listing;
  }

  @Get(':id/asset-details')
  @ApiOperation({ summary: 'Read private operator Asset details for a Listing' })
  @ApiResponse({ status: 200, type: ListingAssetDetailsProfileDto })
  async findAssetDetails(@Param('id') id: string, @CurrentUser() user: VerifiedPrincipal) {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.listingService.findAssetDetails(id);
  }

  @Put(':id/asset-details')
  @ApiOperation({ summary: 'Create or replace private operator Asset details for a Listing' })
  @ApiResponse({ status: 200, type: ListingAssetDetailsProfileDto })
  async saveAssetDetails(
    @Param('id') id: string,
    @Body() dto: ListingAssetDetailsDto,
    @CurrentUser() user: VerifiedPrincipal,
  ) {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.listingService.saveAssetDetails(id, dto);
  }

  @Get(':id/media')
  async listAssetMedia(@Param('id') id: string, @CurrentUser() user: VerifiedPrincipal) {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.media.list(id);
  }

  @Patch(':id/media/:mediaId/public')
  async setAssetMediaPublic(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @Body() dto: SetListingAssetMediaPublicDto,
    @CurrentUser() user: VerifiedPrincipal,
  ) {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.media.setPublic(id, mediaId, dto.isPublic);
  }

  @Post(':id/media')
  async uploadAssetMedia(@Param('id') id: string, @Body() dto: UploadListingAssetMediaDto, @CurrentUser() user: VerifiedPrincipal) {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.media.upload(id, dto);
  }

  @Get(':id/media/:mediaId/content')
  @Header('Cache-Control', 'private, no-store')
  async assetMediaContent(@Param('id') id: string, @Param('mediaId') mediaId: string, @CurrentUser() user: VerifiedPrincipal) {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.media.content(id, mediaId);
  }

  @Patch(':id/media/order')
  async reorderAssetMedia(@Param('id') id: string, @Body() dto: ReorderListingAssetMediaDto, @CurrentUser() user: VerifiedPrincipal) {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.media.reorder(id, dto);
  }

  @Delete(':id/media/:mediaId')
  async removeAssetMedia(@Param('id') id: string, @Param('mediaId') mediaId: string, @CurrentUser() user: VerifiedPrincipal) {
    await this.authz.assertOperatesListing(user.userId, id);
    await this.media.remove(id, mediaId);
    return { removed: true };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Listing by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'Listing details', type: ListingProfileDto })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ListingProfile> {
    const listing = await this.listingService.findById(id);
    if (listing.status !== 'published' && user) {
      await this.authz.assertOperatesListing(user.userId, id);
    }
    return listing;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Listing content' })
  @ApiParam({ name: 'id', type: String, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'Updated listing', type: ListingProfileDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ListingProfile> {
    if (user) {
      await this.authz.assertOperatesListing(user.userId, id);
    }
    return this.listingService.updateContent(id, dto);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Explicitly unpublish a currently published Listing' })
  @ApiParam({ name: 'id', type: String, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'Unpublished listing', type: ListingProfileDto })
  async unpublish(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<ListingProfile> {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.listingService.transition(
      id,
      'unpublished',
      this.commandContext('MANUAL_UNPUBLISH', user),
    );
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive an eligible draft or unpublished Listing' })
  @ApiParam({ name: 'id', type: String, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'Archived listing', type: ListingProfileDto })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<ListingProfile> {
    await this.authz.assertOperatesListing(user.userId, id);
    return this.listingService.transition(id, 'archived', this.commandContext('MANUAL_ARCHIVE', user));
  }

  private commandContext(reasonCode: string, user: VerifiedPrincipal): ListingTransitionEventInput {
    return {
      reasonCode,
      actorType: 'USER',
      actorUserId: user.userId,
      trigger: 'COMMAND',
    };
  }
}

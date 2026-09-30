import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { Inquiry } from '../contracts';
import { CreateInquiryDto, InquiryDto } from '../dto';
import { InquiryService } from '../services/inquiry.service';

@ApiTags('Inquiry')
@Controller('inquiries')
export class InquiryController {
  constructor(
    @Inject(InquiryService)
    private readonly inquiryService: InquiryService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Record discovery/contact intent for a Listing' })
  @ApiResponse({ status: 201, description: 'Inquiry created', type: InquiryDto })
  async create(
    @Body() dto: CreateInquiryDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<Inquiry> {
    if (user) {
      dto.senderUserId = user.userId;
    }
    return this.inquiryService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Inquiry by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Inquiry ID' })
  @ApiResponse({ status: 200, description: 'Inquiry details', type: InquiryDto })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<Inquiry> {
    const inquiry = await this.inquiryService.findById(id);
    if (user && inquiry.senderUserId !== user.userId) {
      await this.authz.assertOperatesListing(user.userId, inquiry.listingId);
    }
    return inquiry;
  }

  @Get()
  @ApiOperation({ summary: 'Find Inquiries by Listing ID' })
  @ApiQuery({ name: 'listingId', type: String, required: true, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'List of inquiries', type: [InquiryDto] })
  async findByListingId(
    @Query('listingId') listingId: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<Inquiry[]> {
    if (user) {
      await this.authz.assertOperatesListing(user.userId, listingId);
    }
    return this.inquiryService.findByListingId(listingId);
  }
}

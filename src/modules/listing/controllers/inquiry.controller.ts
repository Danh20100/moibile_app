import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { Inquiry } from '../contracts';
import { CreateInquiryDto, InquiryDto } from '../dto';
import { InquiryService } from '../services/inquiry.service';

@ApiTags('Inquiry')
@Controller('inquiries')
export class InquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  @Post()
  @ApiOperation({ summary: 'Record discovery/contact intent for a Listing' })
  @ApiResponse({ status: 201, description: 'Inquiry created', type: InquiryDto })
  async create(@Body() dto: CreateInquiryDto): Promise<Inquiry> {
    return this.inquiryService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Inquiry by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Inquiry ID' })
  @ApiResponse({ status: 200, description: 'Inquiry details', type: InquiryDto })
  async findById(@Param('id') id: string): Promise<Inquiry> {
    return this.inquiryService.findById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Find Inquiries by Listing ID' })
  @ApiQuery({ name: 'listingId', type: String, required: true, description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'List of inquiries', type: [InquiryDto] })
  async findByListingId(@Query('listingId') listingId: string): Promise<Inquiry[]> {
    return this.inquiryService.findByListingId(listingId);
  }
}

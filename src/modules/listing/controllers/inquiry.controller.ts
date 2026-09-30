import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Inquiry } from '../contracts';
import { CreateInquiryDto } from '../dto';
import { InquiryService } from '../services/inquiry.service';

@ApiTags('Inquiry')
@Controller('inquiries')
export class InquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  @Post()
  @ApiOperation({ summary: 'Record discovery/contact intent for a Listing' })
  async create(@Body() dto: CreateInquiryDto): Promise<Inquiry> {
    return this.inquiryService.create(dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Inquiry> {
    return this.inquiryService.findById(id);
  }

  @Get()
  async findByListingId(@Query('listingId') listingId: string): Promise<Inquiry[]> {
    return this.inquiryService.findByListingId(listingId);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../common';
import { ListingContent } from '../contracts';
import { CreateListingDto, UpdateListingDto, UpdateListingStatusDto } from '../dto';
import { ListingService } from '../services/listing.service';

@ApiTags('Listing')
@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo bản nháp tin đăng phòng cho thuê (status: draft)' })
  @ApiResponse({ status: 201, description: 'Bản nháp tin đăng đã được tạo' })
  async create(@Body() dto: CreateListingDto): Promise<ListingContent> {
    return this.listingService.create(dto);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Tìm kiếm danh sách tin đăng công khai (status: published)' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Lọc theo Property ID' })
  @ApiResponse({ status: 200, description: 'Danh sách tin đăng công khai' })
  async findPublic(@Query('propertyId') propertyId?: string): Promise<ListingContent[]> {
    return this.listingService.findPublic(propertyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một tin đăng' })
  @ApiResponse({ status: 200, description: 'Thông tin tin đăng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tin đăng' })
  async findById(@Param('id') id: string): Promise<ListingContent> {
    return this.listingService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật nội dung tin đăng' })
  @ApiResponse({ status: 200, description: 'Nội dung tin đăng đã được cập nhật' })
  async update(@Param('id') id: string, @Body() dto: UpdateListingDto): Promise<ListingContent> {
    return this.listingService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Chuyển đổi trạng thái tin đăng (published / hidden / rented)' })
  @ApiResponse({ status: 200, description: 'Trạng thái tin đăng đã được cập nhật' })
  @ApiResponse({ status: 400, description: 'Chuyển đổi trạng thái không hợp lệ' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateListingStatusDto,
  ): Promise<ListingContent> {
    return this.listingService.updateStatus(id, dto);
  }
}

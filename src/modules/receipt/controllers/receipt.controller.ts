import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ReceiptRecord } from '../contracts';
import { ConfirmReceiptDto, CreateReceiptDto } from '../dto';
import { ReceiptService } from '../services/receipt.service';

@ApiTags('Receipt')
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Post()
  @ApiOperation({ summary: 'Ghi nhận một bản ghi thanh toán / biên nhận vận hành' })
  @ApiResponse({ status: 201, description: 'Biên nhận đã được ghi nhận thành công' })
  async create(@Body() dto: CreateReceiptDto): Promise<ReceiptRecord> {
    return this.receiptService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách biên nhận (có thể lọc theo billingCycleId)' })
  @ApiQuery({ name: 'billingCycleId', required: false, description: 'Lọc theo Billing Cycle ID' })
  @ApiResponse({ status: 200, description: 'Danh sách biên nhận' })
  async findByBillingCycleId(
    @Query('billingCycleId') billingCycleId?: string,
  ): Promise<ReceiptRecord[]> {
    return this.receiptService.findByBillingCycleId(billingCycleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một biên nhận' })
  @ApiResponse({ status: 200, description: 'Thông tin biên nhận' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy biên nhận' })
  async findById(@Param('id') id: string): Promise<ReceiptRecord> {
    return this.receiptService.findById(id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Xác nhận biên nhận thanh toán giữa các bên vận hành' })
  @ApiResponse({ status: 200, description: 'Biên nhận đã được xác nhận' })
  @ApiResponse({ status: 400, description: 'Biên nhận đã được xác nhận trước đó' })
  async confirm(@Param('id') id: string, @Body() dto: ConfirmReceiptDto): Promise<ReceiptRecord> {
    return this.receiptService.confirm(id, dto);
  }
}

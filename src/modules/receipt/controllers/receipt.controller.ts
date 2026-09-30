import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ReceiptRecord } from '../contracts';
import { IssueReceiptDto, ReceiptRecordDto } from '../dto';
import { ReceiptService } from '../services/receipt.service';

@ApiTags('Receipt')
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Post()
  @ApiOperation({ summary: 'Issue receipt for confirmed payment' })
  @ApiResponse({ status: 201, description: 'Receipt issued', type: ReceiptRecordDto })
  async issue(@Body() dto: IssueReceiptDto): Promise<ReceiptRecord> {
    return this.receiptService.issue(dto.paymentId);
  }

  @Get()
  @ApiOperation({ summary: 'Find receipts by payment ID' })
  @ApiQuery({ name: 'paymentId', type: String, required: false })
  @ApiResponse({ status: 200, description: 'List of receipts', type: [ReceiptRecordDto] })
  async findByPaymentId(@Query('paymentId') paymentId?: string): Promise<ReceiptRecord[]> {
    return this.receiptService.findByPaymentId(paymentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get receipt by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Receipt details', type: ReceiptRecordDto })
  async findById(@Param('id') id: string): Promise<ReceiptRecord> {
    return this.receiptService.findById(id);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Void a receipt' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Voided receipt', type: ReceiptRecordDto })
  async void(@Param('id') id: string): Promise<ReceiptRecord> {
    return this.receiptService.void(id);
  }
}

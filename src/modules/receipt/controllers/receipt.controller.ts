import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReceiptRecord } from '../contracts';
import { IssueReceiptDto } from '../dto';
import { ReceiptService } from '../services/receipt.service';

@ApiTags('Receipt')
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}
  @Post() async issue(@Body() dto: IssueReceiptDto): Promise<ReceiptRecord> { return this.receiptService.issue(dto.paymentId); }
  @Get() async findByPaymentId(@Query('paymentId') paymentId?: string): Promise<ReceiptRecord[]> { return this.receiptService.findByPaymentId(paymentId); }
  @Get(':id') async findById(@Param('id') id: string): Promise<ReceiptRecord> { return this.receiptService.findById(id); }
  @Post(':id/void') async void(@Param('id') id: string): Promise<ReceiptRecord> { return this.receiptService.void(id); }
}

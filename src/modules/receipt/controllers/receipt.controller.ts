import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { ReceiptRecord } from '../contracts';
import { IssueReceiptDto, ReceiptRecordDto } from '../dto';
import { ReceiptService } from '../services/receipt.service';

@ApiTags('Receipt')
@Controller('receipts')
export class ReceiptController {
  constructor(
    @Inject(ReceiptService)
    private readonly receiptService: ReceiptService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Issue receipt for confirmed payment' })
  @ApiResponse({ status: 201, description: 'Receipt issued', type: ReceiptRecordDto })
  async issue(
    @Body() dto: IssueReceiptDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ReceiptRecord> {
    if (user) {
      const payment = await this.authz.assertCanAccessPayment(user.userId, dto.paymentId);
      await this.authz.assertOperatesTenancy(user.userId, payment.tenancyId);
    }
    return this.receiptService.issue(dto.paymentId);
  }

  @Get()
  @ApiOperation({ summary: 'Find receipts by payment ID' })
  @ApiQuery({ name: 'paymentId', type: String, required: false })
  @ApiResponse({ status: 200, description: 'List of receipts', type: [ReceiptRecordDto] })
  async findByPaymentId(
    @Query('paymentId') paymentId?: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ReceiptRecord[]> {
    if (paymentId) {
      if (user) {
        await this.authz.assertCanAccessPayment(user.userId, paymentId);
      }
      return this.receiptService.findByPaymentId(paymentId);
    }
    if (user) {
      const all = await this.receiptService.findByPaymentId();
      const accessible = await Promise.all(
        all.map(async (r) => {
          try {
            await this.authz.assertCanAccessReceipt(user.userId, r.id);
            return r;
          } catch {
            return null;
          }
        }),
      );
      return accessible.filter((r): r is ReceiptRecord => r !== null);
    }
    return this.receiptService.findByPaymentId();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get receipt by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Receipt details', type: ReceiptRecordDto })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ReceiptRecord> {
    if (user) {
      await this.authz.assertCanAccessReceipt(user.userId, id);
    }
    return this.receiptService.findById(id);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Void a receipt' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Voided receipt', type: ReceiptRecordDto })
  async void(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<ReceiptRecord> {
    if (user) {
      const receipt = await this.authz.assertCanAccessReceipt(user.userId, id);
      const payment = await this.authz.assertCanAccessPayment(user.userId, receipt.paymentId);
      await this.authz.assertOperatesTenancy(user.userId, payment.tenancyId);
    }
    return this.receiptService.void(id);
  }
}

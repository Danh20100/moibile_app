import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ReceiptRecord } from '../contracts';
import { ConfirmReceiptDto, CreateReceiptDto } from '../dto';

@Injectable()
export class ReceiptService {
  private readonly receipts = new Map<string, ReceiptRecord>();

  async create(dto: CreateReceiptDto): Promise<ReceiptRecord> {
    const id = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const receipt: ReceiptRecord = {
      id,
      billingCycleId: dto.billingCycleId,
      tenancyId: dto.tenancyId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      paidAt: dto.paidAt,
      status: 'recorded',
      note: dto.note,
      createdAt: now,
      updatedAt: now,
    };
    this.receipts.set(id, receipt);
    return receipt;
  }

  async findById(id: string): Promise<ReceiptRecord> {
    const receipt = this.receipts.get(id);
    if (!receipt) {
      throw new NotFoundException(`Không tìm thấy receipt với id: ${id}`);
    }
    return receipt;
  }

  async findByBillingCycleId(billingCycleId?: string): Promise<ReceiptRecord[]> {
    const all = Array.from(this.receipts.values());
    if (!billingCycleId) {
      return all;
    }
    return all.filter((r) => r.billingCycleId === billingCycleId);
  }

  async confirm(id: string, dto: ConfirmReceiptDto): Promise<ReceiptRecord> {
    const receipt = await this.findById(id);
    if (receipt.status === 'confirmed') {
      throw new BadRequestException('Biên nhận này đã được xác nhận trước đó');
    }

    const updated: ReceiptRecord = {
      ...receipt,
      status: 'confirmed',
      confirmedBy: dto.confirmedBy,
      confirmedAt: new Date().toISOString(),
      note: dto.note ? `${receipt.note ?? ''} [Xác nhận]: ${dto.note}`.trim() : receipt.note,
      updatedAt: new Date().toISOString(),
    };
    this.receipts.set(id, updated);
    return updated;
  }
}

import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingService } from '../../billing/services/billing.service';
import { ReceiptRecord } from '../contracts';

@Injectable()
export class ReceiptService {
  private readonly receipts = new Map<string, ReceiptRecord>();
  constructor(private readonly billingService: BillingService) {}

  async issue(paymentId: string): Promise<ReceiptRecord> {
    const payment = await this.billingService.findPaymentById(paymentId);
    if (payment.voidedOrReversedAt) throw new BadRequestException('Receipt requires a non-voided confirmed Payment');
    const current = Array.from(this.receipts.values()).find((value) => value.paymentId === paymentId && value.status === 'ISSUED');
    if (current) throw new BadRequestException('Payment already has a current Receipt');
    const value: ReceiptRecord = { id: randomUUID(), paymentId, status: 'ISSUED', issuedAt: new Date().toISOString() };
    this.receipts.set(value.id, structuredClone(value));
    const previous = Array.from(this.receipts.values()).find((candidate) => candidate.paymentId === paymentId && candidate.status === 'VOIDED' && !candidate.replacementReceiptId);
    if (previous) this.receipts.set(previous.id, { ...previous, replacementReceiptId: value.id });
    return structuredClone(value);
  }

  async findById(id: string): Promise<ReceiptRecord> { const value = this.receipts.get(id); if (!value) throw new NotFoundException(`Receipt not found: ${id}`); return structuredClone(value); }
  async findByPaymentId(paymentId?: string): Promise<ReceiptRecord[]> { return Array.from(this.receipts.values()).filter((value) => !paymentId || value.paymentId === paymentId).map((value) => structuredClone(value)); }
  async void(id: string): Promise<ReceiptRecord> { const value = await this.findById(id); if (value.status === 'VOIDED') throw new BadRequestException('Receipt is already voided'); const updated: ReceiptRecord = { ...value, status: 'VOIDED', voidedAt: new Date().toISOString() }; this.receipts.set(id, updated); return structuredClone(updated); }
}

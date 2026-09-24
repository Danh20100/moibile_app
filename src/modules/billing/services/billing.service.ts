import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { BillingCycle, BillingStatus } from '../contracts';
import { ApplyPaymentOutcomeDto, CreateBillingCycleDto } from '../dto';

@Injectable()
export class BillingService {
  private readonly cycles = new Map<string, BillingCycle>();

  async createCycle(dto: CreateBillingCycleDto): Promise<BillingCycle> {
    const id = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const totalAmount = dto.charges.reduce((sum, c) => sum + c.amount, 0);

    const isPastDue = new Date(dto.dueDate) < new Date();
    const initialStatus: BillingStatus = isPastDue ? 'overdue' : 'due';

    const cycle: BillingCycle = {
      id,
      tenancyId: dto.tenancyId,
      roomId: dto.roomId,
      cycleMonth: dto.cycleMonth,
      charges: dto.charges.map((c) => ({
        type: c.type,
        description: c.description,
        amount: c.amount,
      })),
      totalAmount,
      paidAmount: 0,
      outstandingBalance: totalAmount,
      dueDate: dto.dueDate,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
    };
    this.cycles.set(id, cycle);
    return cycle;
  }

  async findById(id: string): Promise<BillingCycle> {
    const cycle = this.cycles.get(id);
    if (!cycle) {
      throw new NotFoundException(`Không tìm thấy billing cycle với id: ${id}`);
    }
    return cycle;
  }

  async findByTenancyId(tenancyId?: string): Promise<BillingCycle[]> {
    const all = Array.from(this.cycles.values());
    if (!tenancyId) {
      return all;
    }
    return all.filter((b) => b.tenancyId === tenancyId);
  }

  async applyPaymentOutcome(id: string, dto: ApplyPaymentOutcomeDto): Promise<BillingCycle> {
    const cycle = await this.findById(id);

    if (cycle.status === 'paid') {
      throw new BadRequestException('Kỳ thu này đã được thanh toán đầy đủ');
    }

    const newPaidAmount = cycle.paidAmount + dto.amountPaid;
    const newOutstanding = Math.max(0, cycle.totalAmount - newPaidAmount);

    let nextStatus: BillingStatus;
    if (newOutstanding === 0) {
      nextStatus = 'paid';
    } else {
      const isPastDue = new Date(cycle.dueDate) < new Date();
      nextStatus = isPastDue ? 'overdue' : 'partial';
    }

    const updated: BillingCycle = {
      ...cycle,
      paidAmount: newPaidAmount,
      outstandingBalance: newOutstanding,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    this.cycles.set(id, updated);
    return updated;
  }
}

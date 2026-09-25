import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { RoomService } from '../../room/services/room.service';
import { TenancyService } from '../../tenancy/services/tenancy.service';
import { BillingCycle, BillingStatus } from '../contracts';
import { ApplyPaymentOutcomeDto, CreateBillingCycleDto } from '../dto';

@Injectable()
export class BillingService {
  private static readonly cycles = new Map<string, BillingCycle>();

  constructor(
    @Optional() @Inject(TenancyService) private readonly tenancyService?: TenancyService,
    @Optional() @Inject(RoomService) private readonly roomService?: RoomService,
  ) {}

  async createCycle(dto: CreateBillingCycleDto): Promise<BillingCycle> {
    if (this.tenancyService) {
      await this.tenancyService.findById(dto.tenancyId);
    }
    if (this.roomService) {
      await this.roomService.findById(dto.roomId);
    }

    const id = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const totalAmount = dto.charges.reduce((sum, c) => sum + c.amount, 0);

    const today = new Date().toISOString().slice(0, 10);
    let initialStatus: BillingStatus;
    if (dto.dueDate < today) {
      initialStatus = 'overdue';
    } else if (dto.dueDate > today) {
      initialStatus = 'upcoming';
    } else {
      initialStatus = 'due';
    }

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
    BillingService.cycles.set(id, cycle);
    return { ...cycle, charges: cycle.charges.map((c) => ({ ...c })) };
  }

  async findById(id: string): Promise<BillingCycle> {
    const cycle = BillingService.cycles.get(id);
    if (!cycle) {
      throw new NotFoundException(`Không tìm thấy billing cycle với id: ${id}`);
    }
    return { ...cycle, charges: cycle.charges.map((c) => ({ ...c })) };
  }

  async findByTenancyId(tenancyId?: string): Promise<BillingCycle[]> {
    const all = Array.from(BillingService.cycles.values());
    if (!tenancyId) {
      return all.map((b) => ({ ...b, charges: b.charges.map((c) => ({ ...c })) }));
    }
    return all
      .filter((b) => b.tenancyId === tenancyId)
      .map((b) => ({ ...b, charges: b.charges.map((c) => ({ ...c })) }));
  }

  async applyPaymentOutcome(id: string, dto: ApplyPaymentOutcomeDto): Promise<BillingCycle> {
    if (dto.amountPaid <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }

    const cycle = await this.findById(id);

    if (cycle.status === 'paid') {
      throw new BadRequestException('Kỳ thu này đã được thanh toán đầy đủ');
    }

    if (dto.amountPaid > cycle.outstandingBalance) {
      throw new BadRequestException(
        `Số tiền thanh toán (${dto.amountPaid}) vượt quá số tiền còn nợ (${cycle.outstandingBalance})`,
      );
    }

    const newPaidAmount = cycle.paidAmount + dto.amountPaid;
    const newOutstanding = cycle.totalAmount - newPaidAmount;

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
    BillingService.cycles.set(id, updated);
    return { ...updated, charges: updated.charges.map((c) => ({ ...c })) };
  }
}

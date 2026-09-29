import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, isNumeric18Scale2NonNegative } from '../../../common/domain/decimal-string';
import { TenancyService } from '../../tenancy/services/tenancy.service';
import { BillingCycle, Charge, CorrectPaymentInput, CreateBillingCycleInput, Deposit, DepositEvent, DepositPaymentApplication, DepositSettlement, Payment, PaymentAllocation, RecordPaymentInput, SettleDepositInput } from '../contracts';

const CURRENT_CHARGE_TYPES = new Set(['RENT', 'ELECTRICITY', 'WATER']);
const copy = <T>(value: T): T => structuredClone(value);
function cents(value: DecimalString): bigint {
  if (!isNumeric18Scale2NonNegative(value)) throw new BadRequestException('Amount must be a non-negative decimal with at most two decimals');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

@Injectable()
export class BillingService {
  private readonly cycles = new Map<string, BillingCycle>();
  private readonly charges = new Map<string, Charge>();
  private readonly payments = new Map<string, Payment>();
  private readonly allocations = new Map<string, PaymentAllocation>();
  private readonly deposits = new Map<string, Deposit>();
  private readonly depositApplications = new Map<string, DepositPaymentApplication>();
  private readonly depositSettlements = new Map<string, DepositSettlement>();
  private readonly depositEvents = new Map<string, DepositEvent>();

  constructor(private readonly tenancyService: TenancyService) {}

  async createCycle(input: CreateBillingCycleInput): Promise<BillingCycle> {
    await this.tenancyService.findById(input.tenancyId);
    if (input.periodStart > input.periodEnd || input.charges.length === 0) throw new BadRequestException('Billing Cycle period and charges are required');
    for (const candidate of this.cycles.values()) {
      if (candidate.tenancyId === input.tenancyId && candidate.periodStart <= input.periodEnd && input.periodStart <= candidate.periodEnd) throw new BadRequestException('Billing Cycle periods cannot overlap for the same Tenancy');
    }
    const id = randomUUID();
    const charges = input.charges.map((item) => {
      if (!CURRENT_CHARGE_TYPES.has(item.type)) throw new BadRequestException('Charge type must be RENT, ELECTRICITY, or WATER');
      if (cents(item.amount) <= 0n) throw new BadRequestException('Charge amount must be positive');
      const charge: Charge = { id: randomUUID(), billingCycleId: id, ...item };
      this.charges.set(charge.id, copy(charge));
      return charge;
    });
    const cycle: BillingCycle = { ...input, id, charges, createdAt: new Date().toISOString() };
    this.cycles.set(id, copy(cycle));
    return copy(cycle);
  }

  async findById(id: string): Promise<BillingCycle> { const value = this.cycles.get(id); if (!value) throw new NotFoundException(`Billing Cycle not found: ${id}`); return copy(value); }
  async findByTenancyId(tenancyId?: string): Promise<BillingCycle[]> { return Array.from(this.cycles.values()).filter((value) => !tenancyId || value.tenancyId === tenancyId).map(copy); }
  async recordPayment(input: RecordPaymentInput): Promise<Payment> { await this.tenancyService.findById(input.tenancyId); if (cents(input.amount) <= 0n) throw new BadRequestException('Payment amount must be positive'); const value: Payment = { id: randomUUID(), ...input }; this.payments.set(value.id, copy(value)); return copy(value); }
  async findPaymentById(id: string): Promise<Payment> { const value = this.payments.get(id); if (!value) throw new NotFoundException(`Payment not found: ${id}`); return copy(value); }

  async allocatePayment(paymentId: string, chargeId: string, amount: DecimalString): Promise<PaymentAllocation> {
    const payment = await this.assertUsablePayment(paymentId);
    const charge = this.charges.get(chargeId); if (!charge) throw new NotFoundException(`Charge not found: ${chargeId}`);
    if ((await this.findById(charge.billingCycleId)).tenancyId !== payment.tenancyId) throw new BadRequestException('Payment Allocation must stay in the same Tenancy; cross Tenancy allocation is forbidden');
    this.assertPaymentCapacity(payment, amount);
    const value: PaymentAllocation = { id: randomUUID(), paymentId, chargeId, allocatedAmount: amount }; this.allocations.set(value.id, copy(value)); return copy(value);
  }

  async createDeposit(tenancyId: string): Promise<Deposit> {
    await this.tenancyService.findById(tenancyId);
    if (Array.from(this.deposits.values()).some((value) => value.tenancyId === tenancyId)) throw new BadRequestException('Tenancy already has a Deposit lifecycle');
    const value: Deposit = { id: randomUUID(), tenancyId }; this.deposits.set(value.id, value); return copy(value);
  }

  async applyPaymentToDeposit(paymentId: string, depositId: string, amount: DecimalString): Promise<DepositPaymentApplication> {
    const payment = await this.assertUsablePayment(paymentId); const deposit = this.deposits.get(depositId); if (!deposit) throw new NotFoundException(`Deposit not found: ${depositId}`);
    if (deposit.tenancyId !== payment.tenancyId) throw new BadRequestException('Deposit Payment Application must stay in the same Tenancy; cross Tenancy application is forbidden');
    this.assertPaymentCapacity(payment, amount); const appliedAt = new Date().toISOString();
    const value: DepositPaymentApplication = { id: randomUUID(), paymentId, depositId, appliedAmount: amount, appliedAt }; this.depositApplications.set(value.id, copy(value));
    this.appendDepositEvent({ depositId, eventType: 'RECEIVED', amount, occurredAt: appliedAt, paymentApplicationId: value.id }); return copy(value);
  }

  async correctPayment(id: string, input: CorrectPaymentInput): Promise<Payment> {
    const original = await this.assertUsablePayment(id); if (this.usedPaymentCents(id) > 0n) throw new BadRequestException('Allocated Payment must be reversed before correction');
    const replacement = await this.recordPayment({ ...input, tenancyId: original.tenancyId });
    this.payments.set(id, { ...original, voidedOrReversedAt: new Date().toISOString(), correctionNote: input.correctionNote, replacementPaymentId: replacement.id }); return replacement;
  }

  async settleDeposit(depositId: string, input: SettleDepositInput): Promise<DepositSettlement> {
    if (!this.deposits.has(depositId)) throw new NotFoundException(`Deposit not found: ${depositId}`); const refunded = cents(input.refundedAmount); const retained = cents(input.retainedAmount);
    if (refunded + retained <= 0n) throw new BadRequestException('Settlement must refund or retain a positive amount');
    const value: DepositSettlement = { id: randomUUID(), depositId, ...input }; this.depositSettlements.set(value.id, copy(value));
    if (refunded > 0n) this.appendDepositEvent({ depositId, eventType: 'REFUNDED', amount: input.refundedAmount, occurredAt: input.settledAt, settlementId: value.id });
    if (retained > 0n) this.appendDepositEvent({ depositId, eventType: 'RETAINED', amount: input.retainedAmount, occurredAt: input.settledAt, settlementId: value.id }); return copy(value);
  }

  async listDepositEvents(depositId: string): Promise<DepositEvent[]> { return Array.from(this.depositEvents.values()).filter((value) => value.depositId === depositId).map(copy); }
  private async assertUsablePayment(id: string): Promise<Payment> { const value = await this.findPaymentById(id); if (value.voidedOrReversedAt) throw new BadRequestException('Voided or reversed Payment cannot be used'); return value; }
  private assertPaymentCapacity(payment: Payment, requested: DecimalString): void { const value = cents(requested); if (value <= 0n) throw new BadRequestException('Applied amount must be positive'); if (this.usedPaymentCents(payment.id) + value > cents(payment.amount)) throw new BadRequestException('Allocation plus deposit application cannot exceed Payment amount or remaining available amount'); }
  private usedPaymentCents(paymentId: string): bigint { const allocated = Array.from(this.allocations.values()).filter((value) => value.paymentId === paymentId).reduce((sum, value) => sum + cents(value.allocatedAmount), 0n); return Array.from(this.depositApplications.values()).filter((value) => value.paymentId === paymentId).reduce((sum, value) => sum + cents(value.appliedAmount), allocated); }
  private appendDepositEvent(input: Omit<DepositEvent, 'id'>): void { const value: DepositEvent = { id: randomUUID(), ...input }; this.depositEvents.set(value.id, copy(value)); }
}

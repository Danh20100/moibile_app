import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, isNumeric18Scale2NonNegative } from '../../../common/domain/decimal-string';
import type { BillingCycleRecord, ChargeRecord, DepositEventRecord, PaymentRecord } from '../../../persistence/ports/finance.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { BillingTransactionCoordinator } from '../../../persistence/guards/billing-transaction-coordinator';
import { FinanceTransactionCoordinator } from '../../../persistence/guards/finance-transaction-coordinator';
import { TenancyService } from '../../tenancy/services/tenancy.service';
import { resolveBillingDueDate } from '../../tenancy/domain/terms-billing-day';
import { BillingCycle, Charge, CorrectPaymentInput, CreateBillingCycleInput, Deposit, DepositEvent, DepositPaymentApplication, DepositProjection, DepositSettlement, DepositState, Payment, PaymentAllocation, ManualRecordPaymentInput, SettleDepositInput } from '../contracts';

function cents(v: DecimalString): bigint { if (!isNumeric18Scale2NonNegative(v)) throw new BadRequestException('Amount must be a non-negative decimal with at most two decimals'); const [w,f='']=v.split('.'); return BigInt(w)*100n+BigInt(f.padEnd(2,'0')); }
function money(value: bigint): DecimalString { return `${value/100n}.${(value%100n).toString().padStart(2,'0')}`; }
function decimal(value: bigint): DecimalString { const safe=value<0n?0n:value; return money(safe); }
@Injectable()
export class BillingService {
  private readonly billingGuard: BillingTransactionCoordinator; private readonly financeGuard: FinanceTransactionCoordinator;
  constructor(@Inject(TenancyService) private readonly tenancyService: TenancyService,@Inject(TRANSACTION_MANAGER) private readonly tx:TransactionManager){this.billingGuard=new BillingTransactionCoordinator(tx);this.financeGuard=new FinanceTransactionCoordinator(tx);}
  async createCycle(i:CreateBillingCycleInput):Promise<BillingCycle>{
    await this.tenancyService.findById(i.tenancyId);
    if(i.periodStart>i.periodEnd||!i.charges.length)throw new BadRequestException('Billing Cycle period and charges are required');
    const r:BillingCycleRecord={billingCycleId:randomUUID(),tenancyId:i.tenancyId,tenancyTermsId:i.tenancyTermsId,periodStart:i.periodStart,periodEnd:i.periodEnd};
    const charges=i.charges.map((x):Charge=>{if(!['RENT','ELECTRICITY','WATER'].includes(x.type)||cents(x.amount)<=0n)throw new BadRequestException('Charge type and positive amount are required');return{id:randomUUID(),billingCycleId:r.billingCycleId,...x,outstandingAmount:money(cents(x.amount))};});
    await this.billingGuard.createBillingCycle(r,charges.map(x=>this.chargeRecord(x)));
    const now = new Date().toISOString();
    await this.tx.run(async ({ repositories }) => {
      if (repositories.notification) {
        const participants = await repositories.tenancy?.findParticipantsByTenancy(i.tenancyId);
        const linked = participants?.find((p) => p.userId && p.leftAt === null);
        if (linked?.userId) {
          await repositories.notification.createNotification({
            notificationId: randomUUID(),
            recipientUserId: linked.userId,
            category: 'PAYMENT_DUE',
            messageOrPayloadReference: `billing_cycle:${r.billingCycleId}`,
            deliveryStatus: 'PENDING',
            createdAt: now,
            deliveredAt: null,
            readAt: null,
          });
        }
      }
    });
    return{id:r.billingCycleId,tenancyId:i.tenancyId,tenancyTermsId:i.tenancyTermsId,periodStart:i.periodStart,periodEnd:i.periodEnd,dueDate:await this.dueDate(i.tenancyTermsId,i.periodStart),charges};
  }
  async findById(id:string){const r=await this.tx.run(({repositories})=>repositories.finance.findBillingCycle(id));if(!r)throw new NotFoundException(`Billing Cycle not found: ${id}`);return this.cycle(r,await this.tx.run(({repositories})=>repositories.finance.findChargesForCycle(id)));}
  async findByTenancyId(id?:string){const rs=await this.tx.run(({repositories})=>repositories.finance.findBillingCyclesForTenancy(id));return Promise.all(rs.map(async r=>this.cycle(r,await this.tx.run(({repositories})=>repositories.finance.findChargesForCycle(r.billingCycleId)))));}
  async recordPayment(i:ManualRecordPaymentInput):Promise<Payment>{
    this.assertManualPayment(i);
    await this.tenancyService.findById(i.tenancyId);
    if(cents(i.amount)<=0n)throw new BadRequestException('Payment amount must be positive');
    const v:Payment={id:randomUUID(),...i,verification:'USER_RECORDED'};
    const now = new Date().toISOString();
    await this.tx.run(async ({repositories})=>{
      await repositories.finance.insertPayment(this.paymentRecord(v));
      if (repositories.notification) {
        const participants = await repositories.tenancy?.findParticipantsByTenancy(i.tenancyId);
        const linked = participants?.find((p) => p.userId && p.leftAt === null);
        if (linked?.userId) {
          await repositories.notification.createNotification({
            notificationId: randomUUID(),
            recipientUserId: linked.userId,
            category: 'PAYMENT_CONFIRMED',
            messageOrPayloadReference: `payment:${v.id}`,
            deliveryStatus: 'PENDING',
            createdAt: now,
            deliveredAt: null,
            readAt: null,
          });
        }
      }
    });
    return v;
  }
  async findPaymentById(id:string):Promise<Payment>{const r=await this.tx.run(({repositories})=>repositories.finance.findPayment(id));if(!r)throw new NotFoundException(`Payment not found: ${id}`);return this.payment(r);}
  async findPaymentsByTenancyId(tenancyId:string):Promise<Payment[]>{return (await this.tx.run(({repositories})=>repositories.finance.findPaymentsForTenancy(tenancyId))).map((r)=>this.payment(r));}
  async allocatePayment(paymentId:string,chargeId:string,amount:DecimalString):Promise<PaymentAllocation>{await this.usable(paymentId);if(cents(amount)<=0n)throw new BadRequestException('Applied amount must be positive');const v={id:randomUUID(),paymentId,chargeId,allocatedAmount:amount};await this.financeGuard.allocatePayment({paymentAllocationId:v.id,paymentId,chargeId,allocatedAmount:amount});return v;}
  async createDeposit(tenancyId:string):Promise<Deposit>{await this.tenancyService.findById(tenancyId);if(await this.tx.run(({repositories})=>repositories.finance.findDepositForTenancy(tenancyId)))throw new BadRequestException('Tenancy already has a Deposit lifecycle');const v={id:randomUUID(),tenancyId};await this.tx.run(({repositories})=>repositories.finance.insertDeposit({depositId:v.id,tenancyId}));return v;}
  async findDepositById(id:string):Promise<Deposit>{const record=await this.tx.run(({repositories})=>repositories.finance.findDeposit(id));if(!record)throw new NotFoundException(`Deposit not found: ${id}`);return{id:record.depositId,tenancyId:record.tenancyId};}
  async findDepositProjectionForTenancy(tenancyId:string):Promise<DepositProjection>{
    await this.tenancyService.findById(tenancyId);
    return this.tx.run(async({repositories})=>{
      const deposit=await repositories.finance.findDepositForTenancy(tenancyId);
      if(!deposit)throw new NotFoundException(`Deposit not found for Tenancy: ${tenancyId}`);
      const [terms,fundedRaw,settledRaw]=await Promise.all([
        repositories.tenancy.findTermsByTenancy(tenancyId),
        repositories.finance.sumDepositFundedAmount(deposit.depositId),
        repositories.finance.sumDepositSettledAmount(deposit.depositId),
      ]);
      const funded=cents(fundedRaw),settled=cents(settledRaw),held=funded-settled;
      const ordered=[...terms].sort((a,b)=>a.version-b.version);
      const latest=ordered.at(-1);
      const requirements=new Set(ordered.map((term)=>term.agreedDepositRequirement));
      const requirement=latest?.agreedDepositRequirement??null;
      const blockedByOpenPolicy=requirements.size>1&&held>0n;
      let state:DepositState|null=null;
      if(!blockedByOpenPolicy&&requirement!==null){
        const required=cents(requirement);
        if(funded>0n&&settled>=funded)state='SETTLED';
        else if(settled>0n&&settled<funded)state='PENDING_SETTLEMENT';
        else if(required>0n&&funded===0n)state='EXPECTED';
        else if(required>0n&&funded<required)state='PARTIALLY_HELD';
        else if(required>0n&&funded>=required)state='HELD';
      }
      return{
        id:deposit.depositId,
        tenancyId,
        requirementAmount:blockedByOpenPolicy?null:requirement,
        fundedAmount:decimal(funded),
        settledAmount:decimal(settled),
        heldAmount:decimal(held),
        state,
        blockedByOpenPolicy,
      };
    });
  }
  async applyPaymentToDeposit(paymentId:string,depositId:string,amount:DecimalString):Promise<DepositPaymentApplication>{await this.usable(paymentId);if(cents(amount)<=0n)throw new BadRequestException('Applied amount must be positive');const appliedAt=new Date().toISOString(),v={id:randomUUID(),paymentId,depositId,appliedAmount:amount,appliedAt};await this.financeGuard.applyPaymentToDeposit({depositPaymentApplicationId:v.id,paymentId,depositId,appliedAmount:amount,appliedAt},{depositEventId:randomUUID(),depositId,eventType:'RECEIVED',amount,occurredAt:appliedAt,paymentApplicationId:v.id,settlementId:null});return v;}
  async correctPayment(id:string,i:CorrectPaymentInput):Promise<Payment>{this.assertManualPayment(i);const old=await this.usable(id);if(cents(await this.tx.run(({repositories})=>repositories.finance.sumPaymentCommittedAmount(id)))>0n)throw new BadRequestException('Allocated Payment must be reversed before correction');const v:Payment={id:randomUUID(),...i,tenancyId:old.tenancyId,verification:'USER_RECORDED'};await this.financeGuard.correctPayment(id,this.paymentRecord(v),new Date().toISOString(),i.correctionNote);return v;}
  async settleDeposit(depositId:string,i:SettleDepositInput):Promise<DepositSettlement>{if(cents(i.refundedAmount)+cents(i.retainedAmount)<=0n)throw new BadRequestException('Settlement must refund or retain a positive amount');const v={id:randomUUID(),depositId,...i},events:DepositEventRecord[]=[];if(cents(i.refundedAmount)>0n)events.push(this.event(depositId,'REFUNDED',i.refundedAmount,i.settledAt,v.id));if(cents(i.retainedAmount)>0n)events.push(this.event(depositId,'RETAINED',i.retainedAmount,i.settledAt,v.id));await this.financeGuard.settleDeposit({depositSettlementId:v.id,depositId,...i},events);return v;}
  async listDepositEvents(id:string):Promise<DepositEvent[]>{return(await this.tx.run(({repositories})=>repositories.finance.findDepositEvents(id))).map(x=>({id:x.depositEventId,depositId:x.depositId,eventType:x.eventType as DepositEvent['eventType'],amount:x.amount,occurredAt:x.occurredAt,...(x.paymentApplicationId?{paymentApplicationId:x.paymentApplicationId}:{}),...(x.settlementId?{settlementId:x.settlementId}:{})}));}
  private assertManualPayment(i: Omit<ManualRecordPaymentInput, 'tenancyId'>): void {
    if (!['MANUAL_CASH', 'MANUAL_TRANSFER'].includes(i.source) || 'verification' in i) {
      throw new BadRequestException('Manual Payment source must be cash or transfer; verification is server-derived');
    }
  }
  private async usable(id:string){const v=await this.findPaymentById(id);if(v.voidedOrReversedAt)throw new BadRequestException('Voided or reversed Payment cannot be used');return v;}
  private chargeRecord(x:Charge):ChargeRecord{return{chargeId:x.id,billingCycleId:x.billingCycleId,chargeType:x.type,amount:x.amount,utilityConnectionId:null,startMeterReadingId:null,endMeterReadingId:null};}
  private async cycle(x:BillingCycleRecord,cs:ChargeRecord[]):Promise<BillingCycle>{
    const charges:Charge[]=[];
    for(const c of cs){
      const allocated=await this.tx.run(({repositories})=>repositories.finance.sumActiveAllocationsForCharge(c.chargeId));
      const due=cents(c.amount),used=cents(allocated);
      charges.push({id:c.chargeId,billingCycleId:c.billingCycleId,type:c.chargeType as Charge['type'],amount:c.amount,outstandingAmount:used>due?null:money(due-used)});
    }
    return{id:x.billingCycleId,tenancyId:x.tenancyId,tenancyTermsId:x.tenancyTermsId,periodStart:x.periodStart,periodEnd:x.periodEnd,dueDate:await this.dueDate(x.tenancyTermsId,x.periodStart),charges};
  }
  private async dueDate(termsId:string,periodStart:string):Promise<string|null>{
    const terms=await this.tx.run(({repositories})=>repositories.tenancy.findTermsById(termsId));
    const date=/^(\d{4})-(\d{2})-\d{2}$/.exec(periodStart);
    if(!date||Number(date[1])<1)return null;
    try{if(new Date(`${periodStart}T00:00:00Z`).toISOString().slice(0,10)!==periodStart)return null;}catch{return null;}
    return resolveBillingDueDate(terms?.billingDayOrDueDateRule,Number(date[1]),Number(date[2]));
  }
  private paymentRecord(x:Payment):PaymentRecord{return{paymentId:x.id,tenancyId:x.tenancyId,amount:x.amount,source:x.source,verification:x.verification,confirmedAt:x.confirmedAt,voidedOrReversedAt:x.voidedOrReversedAt??null,correctionNote:x.correctionNote??null,replacementPaymentId:x.replacementPaymentId??null};}
  private payment(x:PaymentRecord):Payment{return{id:x.paymentId,tenancyId:x.tenancyId,amount:x.amount,source:x.source as Payment['source'],verification:x.verification as Payment['verification'],confirmedAt:x.confirmedAt,...(x.voidedOrReversedAt?{voidedOrReversedAt:x.voidedOrReversedAt}:{}),...(x.correctionNote?{correctionNote:x.correctionNote}:{}),...(x.replacementPaymentId?{replacementPaymentId:x.replacementPaymentId}:{})};}
  private event(depositId:string,eventType:'REFUNDED'|'RETAINED',amount:DecimalString,occurredAt:string,settlementId:string):DepositEventRecord{return{depositEventId:randomUUID(),depositId,eventType,amount,occurredAt,paymentApplicationId:null,settlementId};}
}

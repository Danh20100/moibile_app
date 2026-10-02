import { sql, type Kysely, type Transaction } from 'kysely';

import type {
  BillingCycleRecord, ChargeRecord, DepositEventRecord, DepositPaymentApplicationRecord,
  DepositRecord, DepositSettlementRecord, FinanceRepository, MeterReadingRecord,
  PaymentAllocationRecord, PaymentClaimRecord, PaymentRecord, ReceiptRecord,
  UtilityConnectionRecord,
} from '../../../persistence/ports/finance.repository';
import type { DecimalString } from '../../../persistence/ports/repositories';
import { mapPostgresError } from '../postgres-error.mapper';
import type { Database } from '../schema.types';

type Executor = Kysely<Database> | Transaction<Database>;

export class PostgresFinanceRepository implements FinanceRepository {
  constructor(private readonly db: Executor) {}

  private async mapped<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) { throw mapPostgresError(error); }
  }
  private async one<T>(query: ReturnType<typeof sql<T>>): Promise<T | undefined> {
    return this.mapped(async () => (await query.execute(this.db)).rows[0]);
  }
  private async many<T>(query: ReturnType<typeof sql<T>>): Promise<T[]> {
    return this.mapped(async () => [...(await query.execute(this.db)).rows]);
  }

  async insertBillingCycle(x: BillingCycleRecord): Promise<void> { await this.mapped(async () => { await this.db.insertInto('billing_cycles').values({ billing_cycle_id: x.billingCycleId, tenancy_id: x.tenancyId, tenancy_terms_id: x.tenancyTermsId, period_start: x.periodStart, period_end: x.periodEnd }).execute(); }); }
  findBillingCycle(id: string) { return this.one<BillingCycleRecord>(sql`SELECT billing_cycle_id AS "billingCycleId", tenancy_id AS "tenancyId", tenancy_terms_id AS "tenancyTermsId", period_start AS "periodStart", period_end AS "periodEnd" FROM billing_cycles WHERE billing_cycle_id=${id}`); }
  findBillingCyclesForTenancy(id?: string) { return id ? this.many<BillingCycleRecord>(sql`SELECT billing_cycle_id AS "billingCycleId", tenancy_id AS "tenancyId", tenancy_terms_id AS "tenancyTermsId", period_start AS "periodStart", period_end AS "periodEnd" FROM billing_cycles WHERE tenancy_id=${id} ORDER BY period_start, billing_cycle_id`) : this.many<BillingCycleRecord>(sql`SELECT billing_cycle_id AS "billingCycleId", tenancy_id AS "tenancyId", tenancy_terms_id AS "tenancyTermsId", period_start AS "periodStart", period_end AS "periodEnd" FROM billing_cycles ORDER BY period_start, billing_cycle_id`); }

  async insertCharge(x: ChargeRecord): Promise<void> { await this.mapped(async () => { await this.db.insertInto('charges').values({ charge_id:x.chargeId,billing_cycle_id:x.billingCycleId,charge_type:x.chargeType,amount:x.amount,utility_connection_id:x.utilityConnectionId,start_meter_reading_id:x.startMeterReadingId,end_meter_reading_id:x.endMeterReadingId }).execute(); }); }
  findCharge(id:string) { return this.one<ChargeRecord>(sql`SELECT charge_id AS "chargeId", billing_cycle_id AS "billingCycleId", charge_type AS "chargeType", amount, utility_connection_id AS "utilityConnectionId", start_meter_reading_id AS "startMeterReadingId", end_meter_reading_id AS "endMeterReadingId" FROM charges WHERE charge_id=${id}`); }
  findChargesForCycle(id:string) { return this.many<ChargeRecord>(sql`SELECT charge_id AS "chargeId", billing_cycle_id AS "billingCycleId", charge_type AS "chargeType", amount, utility_connection_id AS "utilityConnectionId", start_meter_reading_id AS "startMeterReadingId", end_meter_reading_id AS "endMeterReadingId" FROM charges WHERE billing_cycle_id=${id} ORDER BY charge_id`); }

  async insertUtilityConnection(x:UtilityConnectionRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('utility_connections').values({utility_connection_id:x.utilityConnectionId,room_id:x.roomId,utility_type:x.utilityType,source_or_provider:x.sourceOrProvider,meter_identifier:x.meterIdentifier}).execute();});}
  findUtilityConnection(id:string){return this.one<UtilityConnectionRecord>(sql`SELECT utility_connection_id AS "utilityConnectionId", room_id AS "roomId", utility_type AS "utilityType", source_or_provider AS "sourceOrProvider", meter_identifier AS "meterIdentifier" FROM utility_connections WHERE utility_connection_id=${id}`);}
  async insertMeterReading(x:MeterReadingRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('meter_readings').values({meter_reading_id:x.meterReadingId,utility_connection_id:x.utilityConnectionId,reading_value:x.readingValue,recorded_at:x.recordedAt,recorded_by_user_id:x.recordedByUserId}).execute();});}
  findMeterReading(id:string){return this.one<MeterReadingRecord>(sql`SELECT meter_reading_id AS "meterReadingId", utility_connection_id AS "utilityConnectionId", reading_value AS "readingValue", recorded_at AS "recordedAt", recorded_by_user_id AS "recordedByUserId" FROM meter_readings WHERE meter_reading_id=${id}`);}

  private paymentValues(x:PaymentRecord){return{payment_id:x.paymentId,tenancy_id:x.tenancyId,amount:x.amount,source:x.source,verification:x.verification,confirmed_at:x.confirmedAt,voided_or_reversed_at:x.voidedOrReversedAt,correction_note:x.correctionNote,replacement_payment_id:x.replacementPaymentId};}
  async insertPayment(x:PaymentRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('payments').values(this.paymentValues(x)).execute();});}
  findPayment(id:string){return this.one<PaymentRecord>(sql`SELECT payment_id AS "paymentId", tenancy_id AS "tenancyId", amount, source, verification, confirmed_at AS "confirmedAt", voided_or_reversed_at AS "voidedOrReversedAt", correction_note AS "correctionNote", replacement_payment_id AS "replacementPaymentId" FROM payments WHERE payment_id=${id}`);}
  findPaymentsForTenancy(id:string){return this.many<PaymentRecord>(sql`SELECT payment_id AS "paymentId", tenancy_id AS "tenancyId", amount, source, verification, confirmed_at AS "confirmedAt", voided_or_reversed_at AS "voidedOrReversedAt", correction_note AS "correctionNote", replacement_payment_id AS "replacementPaymentId" FROM payments WHERE tenancy_id=${id} ORDER BY confirmed_at, payment_id`);}
  async updatePayment(x:PaymentRecord):Promise<void>{const{payment_id:_,...values}=this.paymentValues(x);await this.mapped(async()=>{await this.db.updateTable('payments').set(values).where('payment_id','=',x.paymentId).execute();});}
  async lockPayment(id:string):Promise<void>{await this.mapped(async()=>{await this.db.selectFrom('payments').select('payment_id').where('payment_id','=',id).forUpdate().executeTakeFirst();});}
  async insertPaymentAllocation(x:PaymentAllocationRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('payment_allocations').values({payment_allocation_id:x.paymentAllocationId,payment_id:x.paymentId,charge_id:x.chargeId,allocated_amount:x.allocatedAmount}).execute();});}
  findPaymentAllocations(id:string){return this.many<PaymentAllocationRecord>(sql`SELECT payment_allocation_id AS "paymentAllocationId", payment_id AS "paymentId", charge_id AS "chargeId", allocated_amount AS "allocatedAmount" FROM payment_allocations WHERE payment_id=${id} ORDER BY payment_allocation_id`);}
  async sumPaymentCommittedAmount(id:string):Promise<DecimalString>{return (await this.one<{total:DecimalString}>(sql`SELECT COALESCE(SUM(amount),0)::numeric(18,2) AS total FROM (SELECT allocated_amount AS amount FROM payment_allocations WHERE payment_id=${id} UNION ALL SELECT applied_amount FROM deposit_payment_applications WHERE payment_id=${id}) committed`))?.total ?? '0.00';}
  async paymentHasCapacity(id:string,additionalAmount:DecimalString):Promise<boolean>{return (await this.one<{allowed:boolean}>(sql`SELECT p.amount >= COALESCE((SELECT SUM(amount) FROM (SELECT allocated_amount AS amount FROM payment_allocations WHERE payment_id=p.payment_id UNION ALL SELECT applied_amount FROM deposit_payment_applications WHERE payment_id=p.payment_id) c),0) + ${additionalAmount}::numeric AS allowed FROM payments p WHERE p.payment_id=${id}`))?.allowed??false;}

  private claimValues(x:PaymentClaimRecord){return{payment_claim_id:x.paymentClaimId,tenancy_id:x.tenancyId,submitted_by_user_id:x.submittedByUserId,submitted_by_participant_id:x.submittedByParticipantId,claimed_amount:x.claimedAmount,evidence_reference:x.evidenceReference,status:x.status,submitted_at:x.submittedAt,reviewed_by_user_id:x.reviewedByUserId,reviewed_at:x.reviewedAt,resulting_payment_id:x.resultingPaymentId};}
  async insertPaymentClaim(x:PaymentClaimRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('payment_claims').values(this.claimValues(x)).execute();});}
  findPaymentClaim(id:string){return this.one<PaymentClaimRecord>(sql`SELECT payment_claim_id AS "paymentClaimId", tenancy_id AS "tenancyId", submitted_by_user_id AS "submittedByUserId", submitted_by_participant_id AS "submittedByParticipantId", claimed_amount AS "claimedAmount", evidence_reference AS "evidenceReference", status, submitted_at AS "submittedAt", reviewed_by_user_id AS "reviewedByUserId", reviewed_at AS "reviewedAt", resulting_payment_id AS "resultingPaymentId" FROM payment_claims WHERE payment_claim_id=${id}`);}
  async updatePaymentClaim(x:PaymentClaimRecord):Promise<void>{const{payment_claim_id:_,...v}=this.claimValues(x);await this.mapped(async()=>{await this.db.updateTable('payment_claims').set(v).where('payment_claim_id','=',x.paymentClaimId).execute();});}

  private receiptValues(x:ReceiptRecord){return{receipt_id:x.receiptId,payment_id:x.paymentId,status:x.status,issued_at:x.issuedAt,voided_at:x.voidedAt,replacement_receipt_id:x.replacementReceiptId};}
  async insertReceipt(x:ReceiptRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('receipts').values(this.receiptValues(x)).execute();});}
  findReceipt(id:string){return this.one<ReceiptRecord>(sql`SELECT receipt_id AS "receiptId", payment_id AS "paymentId", status, issued_at AS "issuedAt", voided_at AS "voidedAt", replacement_receipt_id AS "replacementReceiptId" FROM receipts WHERE receipt_id=${id}`);}
  findReceiptsForPayment(id?:string){return id?this.many<ReceiptRecord>(sql`SELECT receipt_id AS "receiptId", payment_id AS "paymentId", status, issued_at AS "issuedAt", voided_at AS "voidedAt", replacement_receipt_id AS "replacementReceiptId" FROM receipts WHERE payment_id=${id} ORDER BY receipt_id`):this.many<ReceiptRecord>(sql`SELECT receipt_id AS "receiptId", payment_id AS "paymentId", status, issued_at AS "issuedAt", voided_at AS "voidedAt", replacement_receipt_id AS "replacementReceiptId" FROM receipts ORDER BY receipt_id`);}
  async updateReceipt(x:ReceiptRecord):Promise<void>{const{receipt_id:_,...v}=this.receiptValues(x);await this.mapped(async()=>{await this.db.updateTable('receipts').set(v).where('receipt_id','=',x.receiptId).execute();});}

  async insertDeposit(x:DepositRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('deposits').values({deposit_id:x.depositId,tenancy_id:x.tenancyId}).execute();});}
  findDeposit(id:string){return this.one<DepositRecord>(sql`SELECT deposit_id AS "depositId", tenancy_id AS "tenancyId" FROM deposits WHERE deposit_id=${id}`);}
  findDepositForTenancy(id:string){return this.one<DepositRecord>(sql`SELECT deposit_id AS "depositId", tenancy_id AS "tenancyId" FROM deposits WHERE tenancy_id=${id}`);}
  async lockDeposit(id:string):Promise<void>{await this.mapped(async()=>{await this.db.selectFrom('deposits').select('deposit_id').where('deposit_id','=',id).forUpdate().executeTakeFirst();});}
  async insertDepositPaymentApplication(x:DepositPaymentApplicationRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('deposit_payment_applications').values({deposit_payment_application_id:x.depositPaymentApplicationId,payment_id:x.paymentId,deposit_id:x.depositId,applied_amount:x.appliedAmount,applied_at:x.appliedAt}).execute();});}
  findDepositPaymentApplications(id:string){return this.many<DepositPaymentApplicationRecord>(sql`SELECT deposit_payment_application_id AS "depositPaymentApplicationId", payment_id AS "paymentId", deposit_id AS "depositId", applied_amount AS "appliedAmount", applied_at AS "appliedAt" FROM deposit_payment_applications WHERE deposit_id=${id} ORDER BY deposit_payment_application_id`);}
  async sumDepositFundedAmount(id:string):Promise<DecimalString>{return (await this.one<{total:DecimalString}>(sql`SELECT COALESCE(SUM(applied_amount),0)::numeric(18,2) AS total FROM deposit_payment_applications WHERE deposit_id=${id}`))?.total??'0.00';}
  async insertDepositSettlement(x:DepositSettlementRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('deposit_settlements').values({deposit_settlement_id:x.depositSettlementId,deposit_id:x.depositId,refunded_amount:x.refundedAmount,retained_amount:x.retainedAmount,reason_or_note:x.reasonOrNote,acted_by_user_id:x.actedByUserId,settled_at:x.settledAt}).execute();});}
  findDepositSettlements(id:string){return this.many<DepositSettlementRecord>(sql`SELECT deposit_settlement_id AS "depositSettlementId", deposit_id AS "depositId", refunded_amount AS "refundedAmount", retained_amount AS "retainedAmount", reason_or_note AS "reasonOrNote", acted_by_user_id AS "actedByUserId", settled_at AS "settledAt" FROM deposit_settlements WHERE deposit_id=${id} ORDER BY deposit_settlement_id`);}
  async sumDepositSettledAmount(id:string):Promise<DecimalString>{return (await this.one<{total:DecimalString}>(sql`SELECT COALESCE(SUM(refunded_amount+retained_amount),0)::numeric(18,2) AS total FROM deposit_settlements WHERE deposit_id=${id}`))?.total??'0.00';}
  async depositHasCapacity(id:string,refundedAmount:DecimalString,retainedAmount:DecimalString):Promise<boolean>{return (await this.one<{allowed:boolean}>(sql`SELECT COALESCE((SELECT SUM(applied_amount) FROM deposit_payment_applications WHERE deposit_id=${id}),0) >= COALESCE((SELECT SUM(refunded_amount+retained_amount) FROM deposit_settlements WHERE deposit_id=${id}),0) + ${refundedAmount}::numeric + ${retainedAmount}::numeric AS allowed`))?.allowed??false;}
  async insertDepositEvent(x:DepositEventRecord):Promise<void>{await this.mapped(async()=>{await this.db.insertInto('deposit_events').values({deposit_event_id:x.depositEventId,deposit_id:x.depositId,event_type:x.eventType,amount:x.amount,occurred_at:x.occurredAt,payment_application_id:x.paymentApplicationId,settlement_id:x.settlementId}).execute();});}
  findDepositEvents(id:string){return this.many<DepositEventRecord>(sql`SELECT deposit_event_id AS "depositEventId", deposit_id AS "depositId", event_type AS "eventType", amount, occurred_at AS "occurredAt", payment_application_id AS "paymentApplicationId", settlement_id AS "settlementId" FROM deposit_events WHERE deposit_id=${id} ORDER BY occurred_at, deposit_event_id`);}
}

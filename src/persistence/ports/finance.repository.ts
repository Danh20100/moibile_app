import type { DateString, DecimalString, TimestampString } from './repositories';

export interface BillingCycleRecord { billingCycleId: string; tenancyId: string; tenancyTermsId: string; periodStart: DateString; periodEnd: DateString }
export interface ChargeRecord { chargeId: string; billingCycleId: string; chargeType: string; amount: DecimalString; utilityConnectionId: string | null; startMeterReadingId: string | null; endMeterReadingId: string | null }
export interface UtilityConnectionRecord { utilityConnectionId: string; roomId: string; utilityType: string; sourceOrProvider: string; meterIdentifier: string | null }
export interface MeterReadingRecord { meterReadingId: string; utilityConnectionId: string; readingValue: DecimalString; recordedAt: TimestampString; recordedByUserId: string | null }
export interface PaymentRecord { paymentId: string; tenancyId: string; amount: DecimalString; source: string; verification: string; confirmedAt: TimestampString; voidedOrReversedAt: TimestampString | null; correctionNote: string | null; replacementPaymentId: string | null }
export interface PaymentAllocationRecord { paymentAllocationId: string; paymentId: string; chargeId: string; allocatedAmount: DecimalString }
export interface PaymentClaimRecord { paymentClaimId: string; tenancyId: string; submittedByUserId: string; submittedByParticipantId: string | null; claimedAmount: DecimalString; evidenceReference: string | null; status: string; submittedAt: TimestampString; reviewedByUserId: string | null; reviewedAt: TimestampString | null; resultingPaymentId: string | null }
export interface ReceiptRecord { receiptId: string; paymentId: string; status: string; issuedAt: TimestampString; voidedAt: TimestampString | null; replacementReceiptId: string | null }
export interface DepositRecord { depositId: string; tenancyId: string }
export interface DepositPaymentApplicationRecord { depositPaymentApplicationId: string; paymentId: string; depositId: string; appliedAmount: DecimalString; appliedAt: TimestampString }
export interface DepositSettlementRecord { depositSettlementId: string; depositId: string; refundedAmount: DecimalString; retainedAmount: DecimalString; reasonOrNote: string; actedByUserId: string; settledAt: TimestampString }
export interface DepositEventRecord { depositEventId: string; depositId: string; eventType: string; amount: DecimalString; occurredAt: TimestampString; paymentApplicationId: string | null; settlementId: string | null }

export interface FinanceRepository {
  insertBillingCycle(input: BillingCycleRecord): Promise<void>; findBillingCycle(id: string): Promise<BillingCycleRecord | undefined>; findBillingCyclesForTenancy(tenancyId: string): Promise<BillingCycleRecord[]>;
  insertCharge(input: ChargeRecord): Promise<void>; findCharge(id: string): Promise<ChargeRecord | undefined>;
  insertUtilityConnection(input: UtilityConnectionRecord): Promise<void>; findUtilityConnection(id: string): Promise<UtilityConnectionRecord | undefined>;
  insertMeterReading(input: MeterReadingRecord): Promise<void>; findMeterReading(id: string): Promise<MeterReadingRecord | undefined>;
  insertPayment(input: PaymentRecord): Promise<void>; findPayment(id: string): Promise<PaymentRecord | undefined>; updatePayment(input: PaymentRecord): Promise<void>; lockPayment(id: string): Promise<void>;
  insertPaymentAllocation(input: PaymentAllocationRecord): Promise<void>; findPaymentAllocations(paymentId: string): Promise<PaymentAllocationRecord[]>; sumPaymentCommittedAmount(paymentId: string): Promise<DecimalString>; paymentHasCapacity(paymentId:string, additionalAmount:DecimalString):Promise<boolean>;
  insertPaymentClaim(input: PaymentClaimRecord): Promise<void>; findPaymentClaim(id: string): Promise<PaymentClaimRecord | undefined>; updatePaymentClaim(input: PaymentClaimRecord): Promise<void>;
  insertReceipt(input: ReceiptRecord): Promise<void>; findReceipt(id: string): Promise<ReceiptRecord | undefined>; updateReceipt(input: ReceiptRecord): Promise<void>;
  insertDeposit(input: DepositRecord): Promise<void>; findDeposit(id: string): Promise<DepositRecord | undefined>; lockDeposit(id: string): Promise<void>;
  insertDepositPaymentApplication(input: DepositPaymentApplicationRecord): Promise<void>; findDepositPaymentApplications(depositId: string): Promise<DepositPaymentApplicationRecord[]>; sumDepositFundedAmount(depositId: string): Promise<DecimalString>;
  insertDepositSettlement(input: DepositSettlementRecord): Promise<void>; findDepositSettlements(depositId: string): Promise<DepositSettlementRecord[]>; sumDepositSettledAmount(depositId: string): Promise<DecimalString>; depositHasCapacity(depositId:string, refundedAmount:DecimalString, retainedAmount:DecimalString):Promise<boolean>;
  insertDepositEvent(input: DepositEventRecord): Promise<void>; findDepositEvents(depositId: string): Promise<DepositEventRecord[]>;
}

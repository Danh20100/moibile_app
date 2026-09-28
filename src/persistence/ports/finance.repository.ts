import type { DateString, DecimalString, TimestampString } from './repositories';

export interface BillingCycleRecord { billing_cycle_id: string; tenancy_id: string; tenancy_terms_id: string; period_start: DateString; period_end: DateString }
export interface ChargeRecord {
  charge_id: string; billing_cycle_id: string; charge_type: string; amount: DecimalString;
  utility_connection_id: string | null; start_meter_reading_id: string | null; end_meter_reading_id: string | null;
}
export interface UtilityConnectionRecord { utility_connection_id: string; room_id: string; utility_type: string; source_or_provider: string; meter_identifier: string | null }
export interface MeterReadingRecord { meter_reading_id: string; utility_connection_id: string; reading_value: DecimalString; recorded_at: TimestampString; recorded_by_user_id: string | null }
export interface PaymentRecord {
  payment_id: string; tenancy_id: string; amount: DecimalString; source: string; verification: string;
  confirmed_at: TimestampString; voided_or_reversed_at: TimestampString | null;
  correction_note: string | null; replacement_payment_id: string | null;
}
export interface PaymentAllocationRecord { payment_allocation_id: string; payment_id: string; charge_id: string; allocated_amount: DecimalString }
export interface PaymentClaimRecord {
  payment_claim_id: string; tenancy_id: string; submitted_by_user_id: string;
  submitted_by_participant_id: string | null; claimed_amount: DecimalString;
  evidence_reference: string | null; status: string; submitted_at: TimestampString;
  reviewed_by_user_id: string | null; reviewed_at: TimestampString | null; resulting_payment_id: string | null;
}
export interface ReceiptRecord { receipt_id: string; payment_id: string; status: string; issued_at: TimestampString; voided_at: TimestampString | null; replacement_receipt_id: string | null }
export interface DepositRecord { deposit_id: string; tenancy_id: string }
export interface DepositPaymentApplicationRecord { deposit_payment_application_id: string; payment_id: string; deposit_id: string; applied_amount: DecimalString; applied_at: TimestampString }
export interface DepositSettlementRecord { deposit_settlement_id: string; deposit_id: string; refunded_amount: DecimalString; retained_amount: DecimalString; reason_or_note: string; acted_by_user_id: string; settled_at: TimestampString }
export interface DepositEventRecord { deposit_event_id: string; deposit_id: string; event_type: string; amount: DecimalString; occurred_at: TimestampString; payment_application_id: string | null; settlement_id: string | null }

export interface CreateBillingCycleInput extends BillingCycleRecord {}
export interface CreateChargeInput extends ChargeRecord {}
export interface CreateUtilityConnectionInput extends UtilityConnectionRecord {}
export interface CreateMeterReadingInput extends MeterReadingRecord {}
export interface CreatePaymentInput extends PaymentRecord {}
export interface CreatePaymentAllocationInput extends PaymentAllocationRecord {}
export interface CreatePaymentClaimInput extends PaymentClaimRecord {}
export interface CreateReceiptInput extends ReceiptRecord {}
export interface CreateDepositInput extends DepositRecord {}
export interface CreateDepositPaymentApplicationInput extends DepositPaymentApplicationRecord {}
export interface CreateDepositSettlementInput extends DepositSettlementRecord {}
export interface CreateDepositEventInput extends DepositEventRecord {}

export interface FinanceRepository {
  insertBillingCycle(input: CreateBillingCycleInput): Promise<void>;
  findBillingCycle(billingCycleId: string): Promise<BillingCycleRecord | undefined>;
  findBillingCyclesByTenancy(tenancyId: string): Promise<BillingCycleRecord[]>;
  insertCharge(input: CreateChargeInput): Promise<void>;
  findCharge(chargeId: string): Promise<ChargeRecord | undefined>;
  insertUtilityConnection(input: CreateUtilityConnectionInput): Promise<void>;
  findUtilityConnection(connectionId: string): Promise<UtilityConnectionRecord | undefined>;
  insertMeterReading(input: CreateMeterReadingInput): Promise<void>;
  findMeterReading(readingId: string): Promise<MeterReadingRecord | undefined>;
  insertPayment(input: CreatePaymentInput): Promise<void>;
  findPayment(paymentId: string): Promise<PaymentRecord | undefined>;
  updatePayment(record: PaymentRecord): Promise<void>;
  lockPayment(paymentId: string): Promise<void>;
  insertPaymentAllocation(input: CreatePaymentAllocationInput): Promise<void>;
  findPaymentAllocations(paymentId: string): Promise<PaymentAllocationRecord[]>;
  insertPaymentClaim(input: CreatePaymentClaimInput): Promise<void>;
  findPaymentClaim(claimId: string): Promise<PaymentClaimRecord | undefined>;
  updatePaymentClaim(record: PaymentClaimRecord): Promise<void>;
  insertReceipt(input: CreateReceiptInput): Promise<void>;
  findReceipt(receiptId: string): Promise<ReceiptRecord | undefined>;
  updateReceipt(record: ReceiptRecord): Promise<void>;
  insertDeposit(input: CreateDepositInput): Promise<void>;
  findDeposit(depositId: string): Promise<DepositRecord | undefined>;
  lockDeposit(depositId: string): Promise<void>;
  insertDepositPaymentApplication(input: CreateDepositPaymentApplicationInput): Promise<void>;
  findDepositPaymentApplications(depositId: string): Promise<DepositPaymentApplicationRecord[]>;
  insertDepositSettlement(input: CreateDepositSettlementInput): Promise<void>;
  findDepositSettlements(depositId: string): Promise<DepositSettlementRecord[]>;
  insertDepositEvent(input: CreateDepositEventInput): Promise<void>;
  findDepositEvents(depositId: string): Promise<DepositEventRecord[]>;
}

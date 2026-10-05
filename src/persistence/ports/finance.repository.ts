import type { MomoRequestSnapshot } from '../../modules/payment-gateway/momo/momo-client';
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
export type GatewayCheckoutStatus = 'INITIATED' | 'CREATED' | 'UNKNOWN' | 'FAILED' | 'SUCCEEDED';
export interface GatewayCheckoutRecord {
  idempotencyKey: string | null;
  fingerprint: string | null;
  requestSnapshot: MomoRequestSnapshot | null;
  providerPartnerCode: string | null;
  firstDispatchAt: TimestampString | null;
  dispatchLeaseOwner: string | null;
  dispatchLeaseUntil: TimestampString | null;
  replayBlocker: string | null;
  providerOutcome: string | null;
  providerResultCode: number | null;
  providerOutcomeStage: 'CREATE' | 'PAYMENT_IPN' | null;
  terminalEvidence: string | null;
  providerTransId: string | null;
  checkoutId: string;
  tenancyId: string;
  createdByUserId: string;
  amount: DecimalString;
  referenceCode: string;
  provider: 'MOMO';
  providerOrderId: string;
  providerRequestId: string;
  status: GatewayCheckoutStatus;
  payUrl: string | null;
  deeplink: string | null;
  resultingPaymentId: string | null;
  lastIpnPayload: string | null;
  lastIpnAt: TimestampString | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

export interface FinanceRepository {
  insertBillingCycle(input: BillingCycleRecord): Promise<void>; findBillingCycle(id: string): Promise<BillingCycleRecord | undefined>; findBillingCyclesForTenancy(tenancyId?: string): Promise<BillingCycleRecord[]>;
  insertCharge(input: ChargeRecord): Promise<void>; findCharge(id: string): Promise<ChargeRecord | undefined>; findChargesForCycle(cycleId: string): Promise<ChargeRecord[]>;
  insertUtilityConnection(input: UtilityConnectionRecord): Promise<void>; findUtilityConnection(id: string): Promise<UtilityConnectionRecord | undefined>;
  insertMeterReading(input: MeterReadingRecord): Promise<void>; findMeterReading(id: string): Promise<MeterReadingRecord | undefined>;
  insertPayment(input: PaymentRecord): Promise<void>; findPayment(id: string): Promise<PaymentRecord | undefined>; findPaymentsForTenancy(tenancyId: string): Promise<PaymentRecord[]>; updatePayment(input: PaymentRecord): Promise<void>; lockPayment(id: string): Promise<void>;
  insertPaymentAllocation(input: PaymentAllocationRecord): Promise<void>; findPaymentAllocations(paymentId: string): Promise<PaymentAllocationRecord[]>; sumPaymentCommittedAmount(paymentId: string): Promise<DecimalString>; paymentHasCapacity(paymentId:string, additionalAmount:DecimalString):Promise<boolean>;
  insertPaymentClaim(input: PaymentClaimRecord): Promise<void>; findPaymentClaim(id: string): Promise<PaymentClaimRecord | undefined>; updatePaymentClaim(input: PaymentClaimRecord): Promise<void>;
  insertReceipt(input: ReceiptRecord): Promise<void>; findReceipt(id: string): Promise<ReceiptRecord | undefined>; findReceiptsForPayment(paymentId?: string): Promise<ReceiptRecord[]>; updateReceipt(input: ReceiptRecord): Promise<void>;
  insertDeposit(input: DepositRecord): Promise<void>; findDeposit(id: string): Promise<DepositRecord | undefined>; findDepositForTenancy(tenancyId: string): Promise<DepositRecord | undefined>; lockDeposit(id: string): Promise<void>;
  insertDepositPaymentApplication(input: DepositPaymentApplicationRecord): Promise<void>; findDepositPaymentApplications(depositId: string): Promise<DepositPaymentApplicationRecord[]>; sumDepositFundedAmount(depositId: string): Promise<DecimalString>;
  insertDepositSettlement(input: DepositSettlementRecord): Promise<void>; findDepositSettlements(depositId: string): Promise<DepositSettlementRecord[]>; sumDepositSettledAmount(depositId: string): Promise<DecimalString>; depositHasCapacity(depositId:string, refundedAmount:DecimalString, retainedAmount:DecimalString):Promise<boolean>;
  insertDepositEvent(input: DepositEventRecord): Promise<void>; findDepositEvents(depositId: string): Promise<DepositEventRecord[]>;
  insertGatewayCheckout(input: GatewayCheckoutRecord): Promise<void>;
  findGatewayCheckout(id: string): Promise<GatewayCheckoutRecord | undefined>;
  findGatewayCheckoutByOrderId(orderId: string): Promise<GatewayCheckoutRecord | undefined>;
  findGatewayCheckoutByClientKey(userId: string, key: string): Promise<GatewayCheckoutRecord | undefined>;
  acquireGatewayDispatchLease(id: string, owner: string, now: string, leaseUntil: string): Promise<boolean>;
  lockGatewayCheckout(id: string): Promise<void>;
  updateGatewayCheckout(input: GatewayCheckoutRecord): Promise<void>;
}

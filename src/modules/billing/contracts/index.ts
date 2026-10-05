import { DecimalString } from '../../../common/domain/decimal-string';

export type ChargeType = 'RENT' | 'ELECTRICITY' | 'WATER';
export type PaymentSource = 'MANUAL_CASH' | 'MANUAL_TRANSFER' | 'GATEWAY';
export type PaymentVerification = 'USER_RECORDED' | 'PROVIDER_VERIFIED';
export type DepositEventType = 'RECEIVED' | 'REFUNDED' | 'RETAINED';
export type DepositState = 'EXPECTED' | 'PARTIALLY_HELD' | 'HELD' | 'PENDING_SETTLEMENT' | 'SETTLED';

export interface Charge { id: string; billingCycleId: string; type: ChargeType; amount: DecimalString; }
export interface BillingCycle { id: string; tenancyId: string; tenancyTermsId: string; periodStart: string; periodEnd: string; charges: Charge[]; }
export interface Payment { id: string; tenancyId: string; amount: DecimalString; source: PaymentSource; verification: PaymentVerification; confirmedAt: string; voidedOrReversedAt?: string; correctionNote?: string; replacementPaymentId?: string; }
export interface PaymentAllocation { id: string; paymentId: string; chargeId: string; allocatedAmount: DecimalString; }
export interface Deposit { id: string; tenancyId: string; }
export interface DepositProjection {
  id: string;
  tenancyId: string;
  requirementAmount: DecimalString | null;
  fundedAmount: DecimalString;
  settledAmount: DecimalString;
  heldAmount: DecimalString;
  state: DepositState | null;
  blockedByOpenPolicy: boolean;
}
export interface DepositPaymentApplication { id: string; paymentId: string; depositId: string; appliedAmount: DecimalString; appliedAt: string; }
export interface DepositSettlement { id: string; depositId: string; refundedAmount: DecimalString; retainedAmount: DecimalString; reasonOrNote: string; actedByUserId: string; settledAt: string; }
export interface DepositEvent { id: string; depositId: string; eventType: DepositEventType; amount: DecimalString; occurredAt: string; paymentApplicationId?: string; settlementId?: string; }

export interface CreateBillingCycleInput { tenancyId: string; tenancyTermsId: string; periodStart: string; periodEnd: string; charges: Array<{ type: ChargeType; amount: DecimalString }>; }
export type ManualPaymentSource = Exclude<PaymentSource, 'GATEWAY'>;
export interface ManualRecordPaymentInput { tenancyId: string; amount: DecimalString; source: ManualPaymentSource; confirmedAt: string; }
export interface CorrectPaymentInput extends Omit<ManualRecordPaymentInput, 'tenancyId'> { correctionNote: string; }
export interface SettleDepositInput { refundedAmount: DecimalString; retainedAmount: DecimalString; reasonOrNote: string; actedByUserId: string; settledAt: string; }

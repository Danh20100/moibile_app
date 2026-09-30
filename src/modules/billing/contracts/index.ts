import { DecimalString } from '../../../common/domain/decimal-string';

export type ChargeType = 'RENT' | 'ELECTRICITY' | 'WATER';
export type PaymentSource = 'MANUAL_CASH' | 'MANUAL_TRANSFER' | 'GATEWAY';
export type PaymentVerification = 'USER_RECORDED' | 'PROVIDER_VERIFIED';
export type DepositEventType = 'RECEIVED' | 'REFUNDED' | 'RETAINED';

export interface Charge { id: string; billingCycleId: string; type: ChargeType; amount: DecimalString; }
export interface BillingCycle { id: string; tenancyId: string; tenancyTermsId: string; periodStart: string; periodEnd: string; charges: Charge[]; }
export interface Payment { id: string; tenancyId: string; amount: DecimalString; source: PaymentSource; verification: PaymentVerification; confirmedAt: string; voidedOrReversedAt?: string; correctionNote?: string; replacementPaymentId?: string; }
export interface PaymentAllocation { id: string; paymentId: string; chargeId: string; allocatedAmount: DecimalString; }
export interface Deposit { id: string; tenancyId: string; }
export interface DepositPaymentApplication { id: string; paymentId: string; depositId: string; appliedAmount: DecimalString; appliedAt: string; }
export interface DepositSettlement { id: string; depositId: string; refundedAmount: DecimalString; retainedAmount: DecimalString; reasonOrNote: string; actedByUserId: string; settledAt: string; }
export interface DepositEvent { id: string; depositId: string; eventType: DepositEventType; amount: DecimalString; occurredAt: string; paymentApplicationId?: string; settlementId?: string; }

export interface CreateBillingCycleInput { tenancyId: string; tenancyTermsId: string; periodStart: string; periodEnd: string; charges: Array<{ type: ChargeType; amount: DecimalString }>; }
export interface RecordPaymentInput { tenancyId: string; amount: DecimalString; source: PaymentSource; verification: PaymentVerification; confirmedAt: string; }
export interface CorrectPaymentInput extends Omit<RecordPaymentInput, 'tenancyId'> { correctionNote: string; }
export interface SettleDepositInput { refundedAmount: DecimalString; retainedAmount: DecimalString; reasonOrNote: string; actedByUserId: string; settledAt: string; }

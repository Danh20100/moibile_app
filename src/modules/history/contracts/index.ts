import type { BillingCycle, DepositEvent, DepositProjection, Payment } from '../../billing/contracts';
import type { IncidentEvent, IncidentTicket } from '../../incident/contracts';
import type { ListingProfile, ListingStatusEvent } from '../../listing/contracts';
import type { ReceiptRecord } from '../../receipt/contracts';
import type { RoomProfile } from '../../room/contracts';
import type { TenancyNotice, TenancyProfile, TenancyTerms } from '../../tenancy/contracts';

export interface RentalPaymentHistoryEntry {
  payment: Payment;
  receipts: ReceiptRecord[];
}

export interface RentalIncidentHistoryEntry {
  incident: IncidentTicket;
  events: IncidentEvent[];
}

export interface RentalDepositHistory {
  projection: DepositProjection;
  events: DepositEvent[];
}

export interface RentalHistoryProjection {
  tenancy: TenancyProfile;
  terms: TenancyTerms[];
  payments: RentalPaymentHistoryEntry[];
  notices: TenancyNotice[];
  incidents: RentalIncidentHistoryEntry[];
  deposit: RentalDepositHistory | null;
}

export interface ListingOperationalHistoryEntry {
  listing: ListingProfile;
  events: ListingStatusEvent[];
}

export interface TenancyFinanceHistoryEntry {
  tenancy: TenancyProfile;
  billingCycles: BillingCycle[];
  payments: RentalPaymentHistoryEntry[];
  deposit: RentalDepositHistory | null;
}

export interface RoomOperationalHistoryProjection {
  room: RoomProfile;
  listings: ListingOperationalHistoryEntry[];
  tenancies: TenancyFinanceHistoryEntry[];
  incidents: RentalIncidentHistoryEntry[];
}

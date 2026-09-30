export type DecimalString = string;
export type DateString = string;
export type TimestampString = string;
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

declare const geographyBrand: unique symbol;
export type Geography = { readonly [geographyBrand]: 'geography' };

export interface Database {
  users: UsersTable;
  organizations: OrganizationsTable;
  properties: PropertiesTable;
  rooms: RoomsTable;
  listings: ListingsTable;
  listing_status_events: ListingStatusEventsTable;
  inquiries: InquiriesTable;
  tenancies: TenanciesTable;
  tenancy_participants: TenancyParticipantsTable;
  tenancy_terms: TenancyTermsTable;
  terms_acknowledgements: TermsAcknowledgementsTable;
  tenancy_notices: TenancyNoticesTable;
  billing_cycles: BillingCyclesTable;
  charges: ChargesTable;
  utility_connections: UtilityConnectionsTable;
  meter_readings: MeterReadingsTable;
  payments: PaymentsTable;
  payment_allocations: PaymentAllocationsTable;
  payment_claims: PaymentClaimsTable;
  receipts: ReceiptsTable;
  deposits: DepositsTable;
  deposit_payment_applications: DepositPaymentApplicationsTable;
  deposit_settlements: DepositSettlementsTable;
  deposit_events: DepositEventsTable;
  incidents: IncidentsTable;
  incident_events: IncidentEventsTable;
  reviews: ReviewsTable;
  trust_reports: TrustReportsTable;
  notifications: NotificationsTable;
}

export interface UsersTable { user_id: string }
export interface OrganizationsTable {
  organization_id: string; primary_owner_user_id: string; name: string;
}
export interface PropertiesTable {
  property_id: string; organization_id: string; name: string;
  lifecycle_status: string; operational_address_text: string;
  operational_location: Geography; public_location_projection: Geography;
}
export interface RoomsTable {
  room_id: string; property_id: string; name_or_label: string;
  operational_state: string; record_lifecycle: string;
}
export interface ListingsTable {
  listing_id: string; room_id: string; status: string; public_title: string;
  public_description: string; public_price_projection: DecimalString;
  public_location_projection: Geography;
}
export interface ListingStatusEventsTable {
  listing_status_event_id: string; listing_id: string; from_status: string;
  to_status: string; reason_code: string; actor_type: string;
  actor_user_id: string | null; trigger: string; occurred_at: TimestampString;
  metadata: JsonValue | null;
}
export interface InquiriesTable {
  inquiry_id: string; listing_id: string; sender_user_id: string | null;
  contact_intent_or_message: string; status: string; created_at: TimestampString;
}
export interface TenanciesTable {
  tenancy_id: string; room_id: string; status: string;
  started_at: TimestampString | null; ended_at: TimestampString | null;
  end_reason: string | null;
}
export interface TenancyParticipantsTable {
  tenancy_participant_id: string; tenancy_id: string; user_id: string | null;
  role: string; joined_at: TimestampString; left_at: TimestampString | null;
}
export interface TenancyTermsTable {
  tenancy_terms_id: string; tenancy_id: string; version: number;
  rent_amount: DecimalString; agreed_deposit_requirement: DecimalString;
  term_start: DateString; term_end: DateString;
  billing_day_or_due_date_rule: JsonValue; electricity_arrangement: JsonValue;
  water_arrangement: JsonValue; minimal_rental_conditions: JsonValue;
  effective_from_cycle_boundary: DateString;
}
export interface TermsAcknowledgementsTable {
  terms_acknowledgement_id: string; tenancy_terms_id: string;
  tenancy_participant_id: string; user_id: string; acknowledged_at: TimestampString;
}
export interface TenancyNoticesTable {
  tenancy_notice_id: string; tenancy_id: string; notice_type: string;
  issued_by_user_id: string; content_or_note: string; issued_at: TimestampString;
  acknowledged_by_user_id: string | null; acknowledged_at: TimestampString | null;
}
export interface BillingCyclesTable {
  billing_cycle_id: string; tenancy_id: string; tenancy_terms_id: string;
  period_start: DateString; period_end: DateString;
}
export interface ChargesTable {
  charge_id: string; billing_cycle_id: string; charge_type: string;
  amount: DecimalString; utility_connection_id: string | null;
  start_meter_reading_id: string | null; end_meter_reading_id: string | null;
}
export interface UtilityConnectionsTable {
  utility_connection_id: string; room_id: string; utility_type: string;
  source_or_provider: string; meter_identifier: string | null;
}
export interface MeterReadingsTable {
  meter_reading_id: string; utility_connection_id: string;
  reading_value: DecimalString; recorded_at: TimestampString;
  recorded_by_user_id: string | null;
}
export interface PaymentsTable {
  payment_id: string; tenancy_id: string; amount: DecimalString; source: string;
  verification: string; confirmed_at: TimestampString;
  voided_or_reversed_at: TimestampString | null; correction_note: string | null;
  replacement_payment_id: string | null;
}
export interface PaymentAllocationsTable {
  payment_allocation_id: string; payment_id: string; charge_id: string;
  allocated_amount: DecimalString;
}
export interface PaymentClaimsTable {
  payment_claim_id: string; tenancy_id: string; submitted_by_user_id: string;
  submitted_by_participant_id: string | null; claimed_amount: DecimalString;
  evidence_reference: string | null; status: string; submitted_at: TimestampString;
  reviewed_by_user_id: string | null; reviewed_at: TimestampString | null;
  resulting_payment_id: string | null;
}
export interface ReceiptsTable {
  receipt_id: string; payment_id: string; status: string;
  issued_at: TimestampString; voided_at: TimestampString | null;
  replacement_receipt_id: string | null;
}
export interface DepositsTable { deposit_id: string; tenancy_id: string }
export interface DepositPaymentApplicationsTable {
  deposit_payment_application_id: string; payment_id: string; deposit_id: string;
  applied_amount: DecimalString; applied_at: TimestampString;
}
export interface DepositSettlementsTable {
  deposit_settlement_id: string; deposit_id: string;
  refunded_amount: DecimalString; retained_amount: DecimalString;
  reason_or_note: string; acted_by_user_id: string; settled_at: TimestampString;
}
export interface DepositEventsTable {
  deposit_event_id: string; deposit_id: string; event_type: string;
  amount: DecimalString; occurred_at: TimestampString;
  payment_application_id: string | null; settlement_id: string | null;
}
export interface IncidentsTable {
  incident_id: string; room_id: string; reported_by_user_id: string | null;
  category: string; status: string; closure_reason: string | null;
  created_at: TimestampString; closed_at: TimestampString | null;
}
export interface IncidentEventsTable {
  incident_event_id: string; incident_id: string; event_type: string;
  actor_user_id: string | null; note: string | null;
  attachment_reference: string | null; from_status: string | null;
  to_status: string | null; occurred_at: TimestampString;
}
export interface ReviewsTable {
  review_id: string; tenancy_id: string; property_id: string;
  author_user_id: string; author_participant_id: string; overall_rating: number;
  comment: string; landlord_response: string | null;
  landlord_response_by_user_id: string | null;
  landlord_responded_at: TimestampString | null; created_at: TimestampString;
}
export interface TrustReportsTable {
  trust_report_id: string; reporter_user_id: string | null;
  listing_id: string | null; review_id: string | null; reason: string;
  status: string; note_or_evidence_reference: string | null;
  created_at: TimestampString; resolved_at: TimestampString | null;
}
export interface NotificationsTable {
  notification_id: string; recipient_user_id: string; category: string;
  message_or_payload_reference: string; delivery_status: string;
  created_at: TimestampString; delivered_at: TimestampString | null;
  read_at: TimestampString | null;
}

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
  messaging_conversations: { conversation_id: string; inquiry_id: string | null; tenancy_id: string | null; created_at: string };
  messaging_participants: { conversation_id: string; user_id: string; last_read_at: string | null };
  messaging_messages: { message_id: string; conversation_id: string; sender_user_id: string; text: string; created_at: string };
  messaging_attachments: { attachment_id: string; message_id: string; object_key: string; byte_size: number; content_type: string };
  messaging_attachment_upload_intents: MessagingAttachmentUploadIntentsTable;
  users: UsersTable;
  auth_identities: AuthIdentitiesTable;
  user_emails: UserEmailsTable;
  user_profiles: UserProfilesTable;
  user_profile_avatars: UserProfileAvatarsTable;
  user_profile_avatar_intents: UserProfileAvatarIntentsTable;
  identity_auth_challenges: IdentityAuthChallengesTable;
  identity_otp_challenges: IdentityOtpChallengesTable;
  auth_sessions: AuthSessionsTable;
  auth_session_refresh_history: AuthSessionRefreshHistoryTable;
  identity_security_events: IdentitySecurityEventsTable;
  password_credentials: PasswordCredentialsTable;
  organizations: OrganizationsTable;
  properties: PropertiesTable;
  rooms: RoomsTable;
  listings: ListingsTable;
  listing_asset_details: ListingAssetDetailsTable;
  listing_asset_media: ListingAssetMediaTable;
  listing_asset_media_intents: ListingAssetMediaIntentsTable;
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
export interface ListingAssetDetailsTable {
  listing_id: string; management_status: 'DRAFT' | 'ACTIVE'; asset_type: string | null;
  public_area_label: string | null; area_square_meters: DecimalString | null;
  advertised_deposit: DecimalString | null; bedrooms: number | null; bathrooms: number | null;
  furnishing: string | null; amenity_ids: string[]; rules: string[];
  electricity_offer: string | null; water_offer: string | null; service_offer: string | null;
  minimum_term_months: number | null; available_from: DateString | null;
  bathroom_arrangement: 'PRIVATE' | 'SHARED' | null; max_occupants: number | null; floor_label: string | null;
}
export interface ListingAssetMediaTable {
  media_id: string; listing_id: string; object_key: string; content_type: 'image/jpeg' | 'image/png';
  byte_size: number; position: number; public_approved: boolean; created_at: TimestampString;
}
export interface ListingAssetMediaIntentsTable {
  media_id: string; listing_id: string; operation: 'UPLOAD' | 'DELETE'; object_key: string;
  content_type: 'image/jpeg' | 'image/png'; byte_size: number; position: number;
  content_hash: string | null; created_at: TimestampString;
}
export interface MessagingAttachmentUploadIntentsTable {
  attachment_id: string; message_id: string; conversation_id: string; sender_user_id: string;
  object_key: string; byte_size: number; content_type: 'image/jpeg'; created_at: TimestampString;
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


export interface AuthIdentitiesTable { auth_identity_id: string; user_id: string; provider: 'google'; issuer: string; subject: string; linked_at: TimestampString }
export interface UserEmailsTable { user_email_id: string; user_id: string; email_address: string; normalized_email: string; verified_at: TimestampString; verification_source: 'google' | 'email_otp'; email_revision: string }
export interface UserProfilesTable { user_id: string; display_name: string | null; phone_number: string | null; residential_address: string | null; created_at: TimestampString; updated_at: TimestampString }
export interface UserProfileAvatarsTable {
  user_id: string; object_key: string; content_type: 'image/jpeg' | 'image/png';
  byte_size: number; sha256: string; updated_at: TimestampString;
}
export interface UserProfileAvatarIntentsTable {
  user_id: string; operation: 'UPLOAD' | 'DELETE_PREVIOUS'; object_key: string; previous_object_key: string | null;
  content_type: 'image/jpeg' | 'image/png'; byte_size: number; sha256: string;
  created_at: TimestampString;
}
export interface IdentityAuthChallengesTable {
  challenge_id: string; purpose: 'LOGIN' | 'REGISTER' | 'REAUTH_ORGANIZATION_CREATE' | 'INITIAL_PASSWORD_SETUP';
  nonce_sha256: string; user_id: string | null; session_id: string | null;
  created_at: TimestampString; expires_at: TimestampString; consumed_at: TimestampString | null;
}
export interface AuthSessionsTable {
  session_id: string; family_id: string; user_id: string; access_token_sha256: string;
  access_expires_at: TimestampString; refresh_token_sha256: string; created_at: TimestampString;
  last_seen_at: TimestampString; idle_expires_at: TimestampString; absolute_expires_at: TimestampString;
  authenticated_at: TimestampString; revoked_at: TimestampString | null; revoke_reason: string | null;
}
export interface AuthSessionRefreshHistoryTable {
  refresh_token_sha256: string; session_id: string; rotated_at: TimestampString;
}
export interface IdentitySecurityEventsTable {
  event_id: string; user_id: string | null; session_id: string | null;
  event_code: 'CHALLENGE_ISSUED' | 'CHALLENGE_REJECTED' | 'REGISTRATION_SUCCEEDED' | 'REGISTRATION_REJECTED'
    | 'SESSION_CREATED' | 'SESSION_REFRESHED' | 'SESSION_REFRESH_REUSE' | 'SESSION_REFRESH_REJECTED'
    | 'AUTHENTICATION_REJECTED' | 'SESSION_LOGOUT' | 'SESSION_REVOKED' | 'IDENTITY_COLLISION'
    | 'REAUTH_ISSUED' | 'REAUTH_REJECTED' | 'PASSWORD_INITIALIZED' | 'EMAIL_CHANGED' | 'EMAIL_CHANGE_NOTICE_FAILED';
  outcome: 'SUCCESS' | 'REJECTED'; occurred_at: TimestampString; request_metadata: JsonValue;
}
export interface IdentityOtpChallengesTable {
  challenge_id: string; purpose: 'EMAIL_REGISTER' | 'PASSWORD_RESET' | 'EMAIL_CHANGE'; destination_address: string;
  destination_normalized: string; code_hmac: string; pending_password_hash: string | null;
  reset_user_id: string | null; reset_email_revision: string | null; reset_credential_revision: string | null;
  change_user_id: string | null; change_session_id: string | null; change_email_id: string | null; change_email_revision: string | null;
  change_stage: 'CURRENT_EMAIL' | 'NEW_EMAIL' | null;
  change_target_address: string | null; change_target_normalized: string | null;
  display_name: string | null; created_at: TimestampString; expires_at: TimestampString;
  last_sent_at: TimestampString; attempts: number; max_attempts: number;
  consumed_at: TimestampString | null; superseded_at: TimestampString | null;
}
export interface PasswordCredentialsTable { user_id: string; password_hash: string; credential_revision: string; created_at: TimestampString; password_changed_at: TimestampString }

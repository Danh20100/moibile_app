-- Generated from trooi-erd-lv3-physical.json. Do not hand-edit.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    user_id uuid NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (user_id)
);

CREATE TABLE organizations (
    organization_id uuid NOT NULL,
    primary_owner_user_id uuid NOT NULL,
    name text NOT NULL,
    CONSTRAINT pk_organizations PRIMARY KEY (organization_id)
);

CREATE TABLE properties (
    property_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    lifecycle_status text NOT NULL,
    operational_address_text text NOT NULL,
    operational_location geography(Point,4326) NOT NULL,
    public_location_projection geography(Point,4326) NOT NULL,
    CONSTRAINT pk_properties PRIMARY KEY (property_id),
    CONSTRAINT ck_properties_lifecycle_status CHECK (lifecycle_status IN ('ACTIVE','ARCHIVED'))
);

CREATE TABLE rooms (
    room_id uuid NOT NULL,
    property_id uuid NOT NULL,
    name_or_label text NOT NULL,
    operational_state text NOT NULL,
    record_lifecycle text NOT NULL,
    CONSTRAINT pk_rooms PRIMARY KEY (room_id),
    CONSTRAINT ck_rooms_operational_state CHECK (operational_state IN ('VACANT','OCCUPIED','MAINTENANCE','INACTIVE')),
    CONSTRAINT ck_rooms_record_lifecycle CHECK (record_lifecycle IN ('ACTIVE','ARCHIVED'))
);

CREATE TABLE listings (
    listing_id uuid NOT NULL,
    room_id uuid NOT NULL,
    status text NOT NULL,
    public_title text NOT NULL,
    public_description text NOT NULL,
    public_price_projection numeric(18,2) NOT NULL,
    public_location_projection geography(Point,4326) NOT NULL,
    CONSTRAINT pk_listings PRIMARY KEY (listing_id),
    CONSTRAINT ck_listings_status CHECK (status IN ('DRAFT','PUBLISHED','UNPUBLISHED','ARCHIVED')),
    CONSTRAINT ck_listings_public_price_nonnegative CHECK (public_price_projection >= 0)
);

CREATE TABLE listing_status_events (
    listing_status_event_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    reason_code text NOT NULL,
    actor_type text NOT NULL,
    actor_user_id uuid,
    trigger text NOT NULL,
    occurred_at timestamptz NOT NULL,
    metadata jsonb,
    CONSTRAINT pk_listing_status_events PRIMARY KEY (listing_status_event_id),
    CONSTRAINT ck_listing_status_events_from_status CHECK (from_status IN ('DRAFT','PUBLISHED','UNPUBLISHED','ARCHIVED')),
    CONSTRAINT ck_listing_status_events_to_status CHECK (to_status IN ('DRAFT','PUBLISHED','UNPUBLISHED','ARCHIVED'))
);

CREATE TABLE inquiries (
    inquiry_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    sender_user_id uuid,
    contact_intent_or_message text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT pk_inquiries PRIMARY KEY (inquiry_id)
);

CREATE TABLE tenancies (
    tenancy_id uuid NOT NULL,
    room_id uuid NOT NULL,
    status text NOT NULL,
    started_at timestamptz,
    ended_at timestamptz,
    end_reason text,
    CONSTRAINT pk_tenancies PRIMARY KEY (tenancy_id),
    CONSTRAINT ck_tenancies_status CHECK (status IN ('DRAFT','ACTIVE','ENDING','ENDED','CANCELLED')),
    CONSTRAINT ck_tenancies_end_reason CHECK (end_reason IS NULL OR end_reason IN ('TERM_ENDED','TENANT_INITIATED','OPERATOR_INITIATED','MUTUAL','OTHER')),
    CONSTRAINT ck_tenancies_time_order CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE tenancy_participants (
    tenancy_participant_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    user_id uuid,
    role text NOT NULL,
    joined_at timestamptz NOT NULL,
    left_at timestamptz,
    CONSTRAINT pk_tenancy_participants PRIMARY KEY (tenancy_participant_id),
    CONSTRAINT ck_tenancy_participants_role CHECK (role IN ('PRIMARY','OCCUPANT')),
    CONSTRAINT ck_tenancy_participants_time_order CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE TABLE tenancy_terms (
    tenancy_terms_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    version integer NOT NULL,
    rent_amount numeric(18,2) NOT NULL,
    agreed_deposit_requirement numeric(18,2) NOT NULL,
    term_start date NOT NULL,
    term_end date NOT NULL,
    billing_day_or_due_date_rule jsonb NOT NULL,
    electricity_arrangement jsonb NOT NULL,
    water_arrangement jsonb NOT NULL,
    minimal_rental_conditions jsonb NOT NULL,
    effective_from_cycle_boundary date NOT NULL,
    CONSTRAINT pk_tenancy_terms PRIMARY KEY (tenancy_terms_id),
    CONSTRAINT ck_tenancy_terms_version_positive CHECK (version > 0),
    CONSTRAINT ck_tenancy_terms_rent_nonnegative CHECK (rent_amount >= 0),
    CONSTRAINT ck_tenancy_terms_deposit_nonnegative CHECK (agreed_deposit_requirement >= 0),
    CONSTRAINT ck_tenancy_terms_date_order CHECK (term_end >= term_start),
    CONSTRAINT uq_tenancy_terms_tenancy_version UNIQUE (tenancy_id, version)
);

CREATE TABLE terms_acknowledgements (
    terms_acknowledgement_id uuid NOT NULL,
    tenancy_terms_id uuid NOT NULL,
    tenancy_participant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    acknowledged_at timestamptz NOT NULL,
    CONSTRAINT pk_terms_acknowledgements PRIMARY KEY (terms_acknowledgement_id)
);

CREATE TABLE tenancy_notices (
    tenancy_notice_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    notice_type text NOT NULL,
    issued_by_user_id uuid NOT NULL,
    content_or_note text NOT NULL,
    issued_at timestamptz NOT NULL,
    acknowledged_by_user_id uuid,
    acknowledged_at timestamptz,
    CONSTRAINT pk_tenancy_notices PRIMARY KEY (tenancy_notice_id),
    CONSTRAINT ck_tenancy_notices_ack_pair CHECK ((acknowledged_by_user_id IS NULL) = (acknowledged_at IS NULL))
);

CREATE TABLE billing_cycles (
    billing_cycle_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    tenancy_terms_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    CONSTRAINT pk_billing_cycles PRIMARY KEY (billing_cycle_id),
    CONSTRAINT ck_billing_cycles_date_order CHECK (period_end >= period_start)
);

CREATE TABLE charges (
    charge_id uuid NOT NULL,
    billing_cycle_id uuid NOT NULL,
    charge_type text NOT NULL,
    amount numeric(18,2) NOT NULL,
    utility_connection_id uuid,
    start_meter_reading_id uuid,
    end_meter_reading_id uuid,
    CONSTRAINT pk_charges PRIMARY KEY (charge_id),
    CONSTRAINT ck_charges_type CHECK (charge_type IN ('RENT','ELECTRICITY','WATER')),
    CONSTRAINT ck_charges_amount_nonnegative CHECK (amount >= 0),
    CONSTRAINT ck_charges_rent_no_utility CHECK (charge_type <> 'RENT' OR (utility_connection_id IS NULL AND start_meter_reading_id IS NULL AND end_meter_reading_id IS NULL)),
    CONSTRAINT ck_charges_reading_requires_connection CHECK (utility_connection_id IS NOT NULL OR (start_meter_reading_id IS NULL AND end_meter_reading_id IS NULL))
);

CREATE TABLE utility_connections (
    utility_connection_id uuid NOT NULL,
    room_id uuid NOT NULL,
    utility_type text NOT NULL,
    source_or_provider text NOT NULL,
    meter_identifier text,
    CONSTRAINT pk_utility_connections PRIMARY KEY (utility_connection_id),
    CONSTRAINT ck_utility_connections_type CHECK (utility_type IN ('ELECTRICITY','WATER'))
);

CREATE TABLE meter_readings (
    meter_reading_id uuid NOT NULL,
    utility_connection_id uuid NOT NULL,
    reading_value numeric(18,6) NOT NULL,
    recorded_at timestamptz NOT NULL,
    recorded_by_user_id uuid,
    CONSTRAINT pk_meter_readings PRIMARY KEY (meter_reading_id),
    CONSTRAINT ck_meter_readings_nonnegative CHECK (reading_value >= 0)
);

CREATE TABLE payments (
    payment_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    amount numeric(18,2) NOT NULL,
    source text NOT NULL,
    verification text NOT NULL,
    confirmed_at timestamptz NOT NULL,
    voided_or_reversed_at timestamptz,
    correction_note text,
    replacement_payment_id uuid,
    CONSTRAINT pk_payments PRIMARY KEY (payment_id),
    CONSTRAINT ck_payments_amount_nonnegative CHECK (amount >= 0),
    CONSTRAINT ck_payments_source CHECK (source IN ('MANUAL_CASH','MANUAL_TRANSFER','GATEWAY')),
    CONSTRAINT ck_payments_verification CHECK (verification IN ('USER_RECORDED','PROVIDER_VERIFIED')),
    CONSTRAINT ck_payments_replacement_not_self CHECK (replacement_payment_id IS NULL OR replacement_payment_id <> payment_id),
    CONSTRAINT ck_payments_replacement_requires_void CHECK (replacement_payment_id IS NULL OR voided_or_reversed_at IS NOT NULL)
);

CREATE TABLE payment_allocations (
    payment_allocation_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    charge_id uuid NOT NULL,
    allocated_amount numeric(18,2) NOT NULL,
    CONSTRAINT pk_payment_allocations PRIMARY KEY (payment_allocation_id),
    CONSTRAINT ck_payment_allocations_amount_nonnegative CHECK (allocated_amount >= 0)
);

CREATE TABLE payment_claims (
    payment_claim_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    submitted_by_user_id uuid NOT NULL,
    submitted_by_participant_id uuid,
    claimed_amount numeric(18,2) NOT NULL,
    evidence_reference text,
    status text NOT NULL,
    submitted_at timestamptz NOT NULL,
    reviewed_by_user_id uuid,
    reviewed_at timestamptz,
    resulting_payment_id uuid,
    CONSTRAINT pk_payment_claims PRIMARY KEY (payment_claim_id),
    CONSTRAINT ck_payment_claims_amount_nonnegative CHECK (claimed_amount >= 0),
    CONSTRAINT ck_payment_claims_review_pair CHECK ((reviewed_by_user_id IS NULL) = (reviewed_at IS NULL))
);

CREATE TABLE receipts (
    receipt_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    status text NOT NULL,
    issued_at timestamptz NOT NULL,
    voided_at timestamptz,
    replacement_receipt_id uuid,
    CONSTRAINT pk_receipts PRIMARY KEY (receipt_id),
    CONSTRAINT ck_receipts_status CHECK (status IN ('ISSUED','VOIDED')),
    CONSTRAINT ck_receipts_replacement_not_self CHECK (replacement_receipt_id IS NULL OR replacement_receipt_id <> receipt_id),
    CONSTRAINT ck_receipts_replacement_requires_void CHECK (replacement_receipt_id IS NULL OR status = 'VOIDED'),
    CONSTRAINT ck_receipts_status_voided_at CHECK ((status = 'ISSUED' AND voided_at IS NULL) OR (status = 'VOIDED' AND voided_at IS NOT NULL))
);

CREATE TABLE deposits (
    deposit_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    CONSTRAINT pk_deposits PRIMARY KEY (deposit_id),
    CONSTRAINT uq_deposits_tenancy UNIQUE (tenancy_id)
);

CREATE TABLE deposit_payment_applications (
    deposit_payment_application_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    deposit_id uuid NOT NULL,
    applied_amount numeric(18,2) NOT NULL,
    applied_at timestamptz NOT NULL,
    CONSTRAINT pk_deposit_payment_applications PRIMARY KEY (deposit_payment_application_id),
    CONSTRAINT ck_deposit_payment_applications_amount_nonnegative CHECK (applied_amount >= 0)
);

CREATE TABLE deposit_settlements (
    deposit_settlement_id uuid NOT NULL,
    deposit_id uuid NOT NULL,
    refunded_amount numeric(18,2) NOT NULL,
    retained_amount numeric(18,2) NOT NULL,
    reason_or_note text NOT NULL,
    acted_by_user_id uuid NOT NULL,
    settled_at timestamptz NOT NULL,
    CONSTRAINT pk_deposit_settlements PRIMARY KEY (deposit_settlement_id),
    CONSTRAINT ck_deposit_settlements_refunded_nonnegative CHECK (refunded_amount >= 0),
    CONSTRAINT ck_deposit_settlements_retained_nonnegative CHECK (retained_amount >= 0)
);

CREATE TABLE deposit_events (
    deposit_event_id uuid NOT NULL,
    deposit_id uuid NOT NULL,
    event_type text NOT NULL,
    amount numeric(18,2) NOT NULL,
    occurred_at timestamptz NOT NULL,
    payment_application_id uuid,
    settlement_id uuid,
    CONSTRAINT pk_deposit_events PRIMARY KEY (deposit_event_id),
    CONSTRAINT ck_deposit_events_type CHECK (event_type IN ('RECEIVED','REFUNDED','RETAINED')),
    CONSTRAINT ck_deposit_events_amount_nonnegative CHECK (amount >= 0),
    CONSTRAINT ck_deposit_events_provenance CHECK ((event_type = 'RECEIVED' AND payment_application_id IS NOT NULL AND settlement_id IS NULL) OR (event_type IN ('REFUNDED','RETAINED') AND settlement_id IS NOT NULL AND payment_application_id IS NULL))
);

CREATE TABLE incidents (
    incident_id uuid NOT NULL,
    room_id uuid NOT NULL,
    reported_by_user_id uuid,
    category text NOT NULL,
    status text NOT NULL,
    closure_reason text,
    created_at timestamptz NOT NULL,
    closed_at timestamptz,
    CONSTRAINT pk_incidents PRIMARY KEY (incident_id),
    CONSTRAINT ck_incidents_category CHECK (category IN ('ELECTRICAL','PLUMBING','ACCESS_SECURITY','ROOM_FACILITY','APPLIANCE','OTHER')),
    CONSTRAINT ck_incidents_status CHECK (status IN ('REPORTED','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED'))
);

CREATE TABLE incident_events (
    incident_event_id uuid NOT NULL,
    incident_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_user_id uuid,
    note text,
    attachment_reference text,
    from_status text,
    to_status text,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT pk_incident_events PRIMARY KEY (incident_event_id),
    CONSTRAINT ck_incident_events_from_status CHECK (from_status IS NULL OR from_status IN ('REPORTED','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED')),
    CONSTRAINT ck_incident_events_to_status CHECK (to_status IS NULL OR to_status IN ('REPORTED','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED'))
);

CREATE TABLE reviews (
    review_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    property_id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    author_participant_id uuid NOT NULL,
    overall_rating smallint NOT NULL,
    comment text NOT NULL,
    landlord_response text,
    landlord_response_by_user_id uuid,
    landlord_responded_at timestamptz,
    created_at timestamptz NOT NULL,
    CONSTRAINT pk_reviews PRIMARY KEY (review_id),
    CONSTRAINT ck_reviews_response_coherence CHECK ((landlord_response IS NULL AND landlord_response_by_user_id IS NULL AND landlord_responded_at IS NULL) OR (landlord_response IS NOT NULL AND landlord_response_by_user_id IS NOT NULL AND landlord_responded_at IS NOT NULL))
);

CREATE TABLE trust_reports (
    trust_report_id uuid NOT NULL,
    reporter_user_id uuid,
    listing_id uuid,
    review_id uuid,
    reason text NOT NULL,
    status text NOT NULL,
    note_or_evidence_reference text,
    created_at timestamptz NOT NULL,
    resolved_at timestamptz,
    CONSTRAINT pk_trust_reports PRIMARY KEY (trust_report_id),
    CONSTRAINT ck_trust_reports_reason CHECK (reason IN ('INCORRECT_INFORMATION','MISLEADING_PRICE','WRONG_LOCATION','DUPLICATE_LISTING','INAPPROPRIATE_CONTENT','SUSPECTED_FRAUD','PRIVACY_VIOLATION','SPAM','OTHER')),
    CONSTRAINT ck_trust_reports_status CHECK (status IN ('SUBMITTED','UNDER_REVIEW','RESOLVED','REJECTED')),
    CONSTRAINT ck_trust_reports_exactly_one_target CHECK ((listing_id IS NOT NULL) <> (review_id IS NOT NULL))
);

CREATE TABLE notifications (
    notification_id uuid NOT NULL,
    recipient_user_id uuid NOT NULL,
    category text NOT NULL,
    message_or_payload_reference text NOT NULL,
    delivery_status text NOT NULL,
    created_at timestamptz NOT NULL,
    delivered_at timestamptz,
    read_at timestamptz,
    CONSTRAINT pk_notifications PRIMARY KEY (notification_id)
);

ALTER TABLE organizations ADD CONSTRAINT fk_organizations_primary_owner_user FOREIGN KEY (primary_owner_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE properties ADD CONSTRAINT fk_properties_organization FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE NO ACTION;
ALTER TABLE rooms ADD CONSTRAINT fk_rooms_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE NO ACTION;
ALTER TABLE listings ADD CONSTRAINT fk_listings_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE NO ACTION;
ALTER TABLE listing_status_events ADD CONSTRAINT fk_listing_status_events_listing FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE NO ACTION;
ALTER TABLE listing_status_events ADD CONSTRAINT fk_listing_status_events_actor_user FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE inquiries ADD CONSTRAINT fk_inquiries_listing FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE NO ACTION;
ALTER TABLE inquiries ADD CONSTRAINT fk_inquiries_sender_user FOREIGN KEY (sender_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE tenancies ADD CONSTRAINT fk_tenancies_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE NO ACTION;
ALTER TABLE tenancy_participants ADD CONSTRAINT fk_tenancy_participants_tenancy FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id) ON DELETE NO ACTION;
ALTER TABLE tenancy_participants ADD CONSTRAINT fk_tenancy_participants_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE tenancy_terms ADD CONSTRAINT fk_tenancy_terms_tenancy FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id) ON DELETE NO ACTION;
ALTER TABLE terms_acknowledgements ADD CONSTRAINT fk_terms_acknowledgements_terms FOREIGN KEY (tenancy_terms_id) REFERENCES tenancy_terms(tenancy_terms_id) ON DELETE NO ACTION;
ALTER TABLE terms_acknowledgements ADD CONSTRAINT fk_terms_acknowledgements_participant FOREIGN KEY (tenancy_participant_id) REFERENCES tenancy_participants(tenancy_participant_id) ON DELETE NO ACTION;
ALTER TABLE terms_acknowledgements ADD CONSTRAINT fk_terms_acknowledgements_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE tenancy_notices ADD CONSTRAINT fk_tenancy_notices_tenancy FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id) ON DELETE NO ACTION;
ALTER TABLE tenancy_notices ADD CONSTRAINT fk_tenancy_notices_issued_by_user FOREIGN KEY (issued_by_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE tenancy_notices ADD CONSTRAINT fk_tenancy_notices_acknowledged_by_user FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE billing_cycles ADD CONSTRAINT fk_billing_cycles_tenancy FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id) ON DELETE NO ACTION;
ALTER TABLE billing_cycles ADD CONSTRAINT fk_billing_cycles_terms FOREIGN KEY (tenancy_terms_id) REFERENCES tenancy_terms(tenancy_terms_id) ON DELETE NO ACTION;
ALTER TABLE charges ADD CONSTRAINT fk_charges_billing_cycle FOREIGN KEY (billing_cycle_id) REFERENCES billing_cycles(billing_cycle_id) ON DELETE NO ACTION;
ALTER TABLE charges ADD CONSTRAINT fk_charges_utility_connection FOREIGN KEY (utility_connection_id) REFERENCES utility_connections(utility_connection_id) ON DELETE NO ACTION;
ALTER TABLE charges ADD CONSTRAINT fk_charges_start_meter_reading FOREIGN KEY (start_meter_reading_id) REFERENCES meter_readings(meter_reading_id) ON DELETE NO ACTION;
ALTER TABLE charges ADD CONSTRAINT fk_charges_end_meter_reading FOREIGN KEY (end_meter_reading_id) REFERENCES meter_readings(meter_reading_id) ON DELETE NO ACTION;
ALTER TABLE utility_connections ADD CONSTRAINT fk_utility_connections_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE NO ACTION;
ALTER TABLE meter_readings ADD CONSTRAINT fk_meter_readings_connection FOREIGN KEY (utility_connection_id) REFERENCES utility_connections(utility_connection_id) ON DELETE NO ACTION;
ALTER TABLE meter_readings ADD CONSTRAINT fk_meter_readings_recorded_by_user FOREIGN KEY (recorded_by_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE payments ADD CONSTRAINT fk_payments_tenancy FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id) ON DELETE NO ACTION;
ALTER TABLE payments ADD CONSTRAINT fk_payments_replacement_payment FOREIGN KEY (replacement_payment_id) REFERENCES payments(payment_id) ON DELETE NO ACTION;
ALTER TABLE payment_allocations ADD CONSTRAINT fk_payment_allocations_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE NO ACTION;
ALTER TABLE payment_allocations ADD CONSTRAINT fk_payment_allocations_charge FOREIGN KEY (charge_id) REFERENCES charges(charge_id) ON DELETE NO ACTION;
ALTER TABLE payment_claims ADD CONSTRAINT fk_payment_claims_tenancy FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id) ON DELETE NO ACTION;
ALTER TABLE payment_claims ADD CONSTRAINT fk_payment_claims_submitted_by_user FOREIGN KEY (submitted_by_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE payment_claims ADD CONSTRAINT fk_payment_claims_submitted_by_participant FOREIGN KEY (submitted_by_participant_id) REFERENCES tenancy_participants(tenancy_participant_id) ON DELETE NO ACTION;
ALTER TABLE payment_claims ADD CONSTRAINT fk_payment_claims_reviewed_by_user FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE payment_claims ADD CONSTRAINT fk_payment_claims_resulting_payment FOREIGN KEY (resulting_payment_id) REFERENCES payments(payment_id) ON DELETE NO ACTION;
ALTER TABLE receipts ADD CONSTRAINT fk_receipts_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE NO ACTION;
ALTER TABLE receipts ADD CONSTRAINT fk_receipts_replacement_receipt FOREIGN KEY (replacement_receipt_id) REFERENCES receipts(receipt_id) ON DELETE NO ACTION;
ALTER TABLE deposits ADD CONSTRAINT fk_deposits_tenancy FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id) ON DELETE NO ACTION;
ALTER TABLE deposit_payment_applications ADD CONSTRAINT fk_deposit_payment_applications_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE NO ACTION;
ALTER TABLE deposit_payment_applications ADD CONSTRAINT fk_deposit_payment_applications_deposit FOREIGN KEY (deposit_id) REFERENCES deposits(deposit_id) ON DELETE NO ACTION;
ALTER TABLE deposit_settlements ADD CONSTRAINT fk_deposit_settlements_deposit FOREIGN KEY (deposit_id) REFERENCES deposits(deposit_id) ON DELETE NO ACTION;
ALTER TABLE deposit_settlements ADD CONSTRAINT fk_deposit_settlements_acted_by_user FOREIGN KEY (acted_by_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE deposit_events ADD CONSTRAINT fk_deposit_events_deposit FOREIGN KEY (deposit_id) REFERENCES deposits(deposit_id) ON DELETE NO ACTION;
ALTER TABLE deposit_events ADD CONSTRAINT fk_deposit_events_payment_application FOREIGN KEY (payment_application_id) REFERENCES deposit_payment_applications(deposit_payment_application_id) ON DELETE NO ACTION;
ALTER TABLE deposit_events ADD CONSTRAINT fk_deposit_events_settlement FOREIGN KEY (settlement_id) REFERENCES deposit_settlements(deposit_settlement_id) ON DELETE NO ACTION;
ALTER TABLE incidents ADD CONSTRAINT fk_incidents_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE NO ACTION;
ALTER TABLE incidents ADD CONSTRAINT fk_incidents_reported_by_user FOREIGN KEY (reported_by_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE incident_events ADD CONSTRAINT fk_incident_events_incident FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE NO ACTION;
ALTER TABLE incident_events ADD CONSTRAINT fk_incident_events_actor_user FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_tenancy FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id) ON DELETE NO ACTION;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE NO ACTION;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_author_user FOREIGN KEY (author_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_author_participant FOREIGN KEY (author_participant_id) REFERENCES tenancy_participants(tenancy_participant_id) ON DELETE NO ACTION;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_landlord_response_user FOREIGN KEY (landlord_response_by_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE trust_reports ADD CONSTRAINT fk_trust_reports_reporter_user FOREIGN KEY (reporter_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;
ALTER TABLE trust_reports ADD CONSTRAINT fk_trust_reports_listing FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE NO ACTION;
ALTER TABLE trust_reports ADD CONSTRAINT fk_trust_reports_review FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE NO ACTION;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_recipient_user FOREIGN KEY (recipient_user_id) REFERENCES users(user_id) ON DELETE NO ACTION;

CREATE INDEX ix_organizations_primary_owner_user_id ON organizations (primary_owner_user_id);
CREATE INDEX ix_properties_organization_id ON properties (organization_id);
CREATE INDEX ix_rooms_property_id ON rooms (property_id);
CREATE UNIQUE INDEX uq_listings_room_current ON listings (room_id) WHERE status <> 'ARCHIVED';
CREATE INDEX ix_listings_published_location ON listings USING gist (public_location_projection) WHERE status = 'PUBLISHED';
CREATE INDEX ix_listings_published_price ON listings (public_price_projection) WHERE status = 'PUBLISHED';
CREATE INDEX ix_listings_room_id ON listings (room_id);
CREATE INDEX ix_listing_status_events_listing_occurred ON listing_status_events (listing_id, occurred_at);
CREATE INDEX ix_listing_status_events_actor_user_id ON listing_status_events (actor_user_id);
CREATE INDEX ix_inquiries_listing_id ON inquiries (listing_id);
CREATE INDEX ix_inquiries_sender_user_id ON inquiries (sender_user_id);
CREATE UNIQUE INDEX uq_tenancies_room_nonterminal ON tenancies (room_id) WHERE status IN ('DRAFT','ACTIVE','ENDING');
CREATE INDEX ix_tenancies_room_status ON tenancies (room_id, status);
CREATE UNIQUE INDEX uq_tenancy_participants_active_primary ON tenancy_participants (tenancy_id) WHERE role = 'PRIMARY' AND left_at IS NULL;
CREATE INDEX ix_tenancy_participants_tenancy_role_left ON tenancy_participants (tenancy_id, role, left_at);
CREATE INDEX ix_tenancy_participants_user_id ON tenancy_participants (user_id);
CREATE INDEX ix_terms_acknowledgements_tenancy_terms_id ON terms_acknowledgements (tenancy_terms_id);
CREATE INDEX ix_terms_acknowledgements_tenancy_participant_id ON terms_acknowledgements (tenancy_participant_id);
CREATE INDEX ix_terms_acknowledgements_user_id ON terms_acknowledgements (user_id);
CREATE INDEX ix_tenancy_notices_tenancy_id ON tenancy_notices (tenancy_id);
CREATE INDEX ix_tenancy_notices_issued_by_user_id ON tenancy_notices (issued_by_user_id);
CREATE INDEX ix_tenancy_notices_acknowledged_by_user_id ON tenancy_notices (acknowledged_by_user_id);
CREATE INDEX ix_billing_cycles_tenancy_period ON billing_cycles (tenancy_id, period_start, period_end);
CREATE INDEX ix_billing_cycles_tenancy_terms_id ON billing_cycles (tenancy_terms_id);
CREATE INDEX ix_charges_billing_cycle_id ON charges (billing_cycle_id);
CREATE INDEX ix_charges_utility_connection_id ON charges (utility_connection_id);
CREATE INDEX ix_charges_start_meter_reading_id ON charges (start_meter_reading_id);
CREATE INDEX ix_charges_end_meter_reading_id ON charges (end_meter_reading_id);
CREATE INDEX ix_utility_connections_room_id ON utility_connections (room_id);
CREATE INDEX ix_meter_readings_connection_recorded ON meter_readings (utility_connection_id, recorded_at);
CREATE INDEX ix_meter_readings_recorded_by_user_id ON meter_readings (recorded_by_user_id);
CREATE UNIQUE INDEX uq_payments_replacement_payment ON payments (replacement_payment_id) WHERE replacement_payment_id IS NOT NULL;
CREATE INDEX ix_payments_tenancy_confirmed ON payments (tenancy_id, confirmed_at);
CREATE INDEX ix_payments_replacement_payment_id ON payments (replacement_payment_id);
CREATE INDEX ix_payment_allocations_payment_id ON payment_allocations (payment_id);
CREATE INDEX ix_payment_allocations_charge_id ON payment_allocations (charge_id);
CREATE UNIQUE INDEX uq_payment_claims_resulting_payment ON payment_claims (resulting_payment_id) WHERE resulting_payment_id IS NOT NULL;
CREATE INDEX ix_payment_claims_tenancy_id ON payment_claims (tenancy_id);
CREATE INDEX ix_payment_claims_submitted_by_user_id ON payment_claims (submitted_by_user_id);
CREATE INDEX ix_payment_claims_submitted_by_participant_id ON payment_claims (submitted_by_participant_id);
CREATE INDEX ix_payment_claims_reviewed_by_user_id ON payment_claims (reviewed_by_user_id);
CREATE INDEX ix_payment_claims_resulting_payment_id ON payment_claims (resulting_payment_id);
CREATE UNIQUE INDEX uq_receipts_payment_current ON receipts (payment_id) WHERE status = 'ISSUED';
CREATE INDEX ix_receipts_payment_id ON receipts (payment_id);
CREATE INDEX ix_receipts_replacement_receipt_id ON receipts (replacement_receipt_id);
CREATE INDEX ix_deposit_payment_applications_payment_id ON deposit_payment_applications (payment_id);
CREATE INDEX ix_deposit_payment_applications_deposit_id ON deposit_payment_applications (deposit_id);
CREATE INDEX ix_deposit_settlements_deposit_id ON deposit_settlements (deposit_id);
CREATE INDEX ix_deposit_settlements_acted_by_user_id ON deposit_settlements (acted_by_user_id);
CREATE INDEX ix_deposit_events_deposit_id ON deposit_events (deposit_id);
CREATE INDEX ix_deposit_events_payment_application_id ON deposit_events (payment_application_id);
CREATE INDEX ix_deposit_events_settlement_id ON deposit_events (settlement_id);
CREATE INDEX ix_incidents_room_status ON incidents (room_id, status);
CREATE INDEX ix_incidents_reported_by_user_id ON incidents (reported_by_user_id);
CREATE INDEX ix_incident_events_incident_occurred ON incident_events (incident_id, occurred_at);
CREATE INDEX ix_incident_events_actor_user_id ON incident_events (actor_user_id);
CREATE INDEX ix_reviews_tenancy_id ON reviews (tenancy_id);
CREATE INDEX ix_reviews_property_id ON reviews (property_id);
CREATE INDEX ix_reviews_author_user_id ON reviews (author_user_id);
CREATE INDEX ix_reviews_author_participant_id ON reviews (author_participant_id);
CREATE INDEX ix_reviews_landlord_response_by_user_id ON reviews (landlord_response_by_user_id);
CREATE INDEX ix_trust_reports_reporter_user_id ON trust_reports (reporter_user_id);
CREATE INDEX ix_trust_reports_listing_id ON trust_reports (listing_id);
CREATE INDEX ix_trust_reports_review_id ON trust_reports (review_id);
CREATE INDEX ix_notifications_recipient_created ON notifications (recipient_user_id, created_at);

-- Transaction/application guards (not database CHECK constraints)
-- GUARD listing_publish_eligibility: Listing publish requires VACANT active Room under active Property.
-- GUARD room_leave_vacant_unpublish: Room leaving VACANT synchronously unpublishes current Listing.
-- GUARD property_archive_guard: Property archive rechecks child Room/Tenancy/Listing/Incident state.
-- GUARD room_archive_guard: Room archive requires INACTIVE, no nonterminal Tenancy, no open Incident.
-- GUARD tenancy_activation: Activate Tenancy only for eligible Room with exactly one active PRIMARY.
-- GUARD tenancy_checkout: Ending/checkout FSM and Room state transition happen in one transaction.
-- GUARD billing_cycle_no_overlap: Billing cycles for one Tenancy may not overlap.
-- GUARD billing_cycle_terms_provenance: Applied Terms belongs to same Tenancy and valid effective boundary.
-- GUARD payment_allocation_same_tenancy: Payment and allocated Charge must belong to same Tenancy.
-- GUARD deposit_application_same_tenancy: Payment and Deposit application must belong to same Tenancy.
-- GUARD payment_amount_cap: Allocation plus deposit application sum may not exceed Payment amount.
-- GUARD payment_correction: Replacement Payment must share Tenancy and predecessor must be voided/reversed.
-- GUARD receipt_issue: Receipt may only be issued from eligible confirmed Payment.
-- GUARD utility_provenance: Utility Connection belongs to Tenancy Room, type matches Charge, readings share Connection.
-- GUARD deposit_event_provenance_amount: Deposit Event provenance type and amount must match Application/Settlement.
-- GUARD open_incident_archive_blocker: Archive transaction rechecks open Incident.
-- GUARD review_eligibility: Review requires ENDED Tenancy and eligible linked Participant/User.
-- GUARD review_historical_property_target: Review captures historical Property target and does not cascade on reassignment.
-- GUARD payment_claim_consistency: Payment Claim participant and resulting Payment must belong to same Tenancy.
-- GUARD terms_acknowledgement_consistency: Terms and Participant share Tenancy; action User matches linked Participant User.
-- GUARD review_author_identity: Review author Participant belongs to Review Tenancy and links author User.
-- GUARD receipt_replacement: Replacement Receipt belongs to same Payment and predecessor is VOIDED.
-- Reconciliation debt
-- UPSTREAM_RECONCILE deposit_event_amount_single_owner: >> UPSTREAM-RECONCILE: Deposit Event amount ownership.
-- UPSTREAM_RECONCILE review_property_historical_target_upstream: >> UPSTREAM-RECONCILE: Review historical Property target semantics.
-- UPSTREAM_RECONCILE room_property_type_search_filter: >> UPSTREAM-RECONCILE: Canonical Search/Map requires Room/property type filter but owner/vocabulary is unresolved.
-- UPSTREAM_RECONCILE charge_overallocation_policy: >> UPSTREAM-RECONCILE: Charge over-allocation across Payments remains OPEN.
-- UPSTREAM_RECONCILE review_multiplicity_policy: >> UPSTREAM-RECONCILE: Review multiplicity per Participant/Tenancy remains OPEN.
-- DOC_RECONCILE tech_stack_postgis: >> DOC-RECONCILE: tech-stack.md must reflect frozen PostGIS requirement after ERD3 cleanup.

\set ON_ERROR_STOP on
SELECT postgis_version();

DO $body$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
  WHERE ns.nspname='public' AND c.relkind='r' AND c.relname <> 'spatial_ref_sys';
  IF n <> 29 THEN RAISE EXCEPTION 'expected 29 TroOi tables, got %', n; END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.expect_constraint_failure(label text, stmt text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'expected constraint failure: %', label;
EXCEPTION
  WHEN integrity_constraint_violation THEN NULL;
END
$fn$;

INSERT INTO users(user_id) VALUES
('00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-000000000003');

INSERT INTO organizations(organization_id, primary_owner_user_id, name) VALUES
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Org');

INSERT INTO properties(property_id, organization_id, name, lifecycle_status, operational_address_text, operational_location, public_location_projection) VALUES
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Property A','ACTIVE','Address A',ST_GeogFromText('SRID=4326;POINT(106.7 10.8)'),ST_GeogFromText('SRID=4326;POINT(106.7 10.8)'));

INSERT INTO rooms(room_id, property_id, name_or_label, operational_state, record_lifecycle) VALUES
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','R1','VACANT','ACTIVE'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','R2','OCCUPIED','ACTIVE'),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','R3','VACANT','ACTIVE');

INSERT INTO listings(listing_id, room_id, status, public_title, public_description, public_price_projection, public_location_projection) VALUES
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','DRAFT','Room 1','desc',1000,ST_GeogFromText('SRID=4326;POINT(106.7 10.8)'));

INSERT INTO tenancies(tenancy_id, room_id, status, started_at, ended_at, end_reason) VALUES
('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','ACTIVE','2026-01-01T00:00:00Z',NULL,NULL),
('50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','ENDED','2025-01-01T00:00:00Z','2025-12-31T00:00:00Z','TERM_ENDED');

INSERT INTO tenancy_participants(tenancy_participant_id, tenancy_id, user_id, role, joined_at, left_at) VALUES
('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','PRIMARY','2026-01-01T00:00:00Z',NULL),
('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','PRIMARY','2025-01-01T00:00:00Z','2025-12-31T00:00:00Z');

INSERT INTO tenancy_terms(tenancy_terms_id, tenancy_id, version, rent_amount, agreed_deposit_requirement, term_start, term_end, billing_day_or_due_date_rule, electricity_arrangement, water_arrangement, minimal_rental_conditions, effective_from_cycle_boundary) VALUES
('70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',1,1000,500,'2026-01-01','2026-12-31','{}','{}','{}','{}','2026-01-01');

INSERT INTO billing_cycles(billing_cycle_id, tenancy_id, tenancy_terms_id, period_start, period_end) VALUES
('80000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','2026-01-01','2026-01-31');

INSERT INTO utility_connections(utility_connection_id, room_id, utility_type, source_or_provider, meter_identifier) VALUES
('90000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','ELECTRICITY','EVN','M1');

INSERT INTO meter_readings(meter_reading_id, utility_connection_id, reading_value, recorded_at, recorded_by_user_id) VALUES
('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',10,'2026-01-01T00:00:00Z','00000000-0000-0000-0000-000000000001'),
('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001',20,'2026-01-31T00:00:00Z','00000000-0000-0000-0000-000000000001');

INSERT INTO charges(charge_id, billing_cycle_id, charge_type, amount, utility_connection_id, start_meter_reading_id, end_meter_reading_id) VALUES
('92000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','RENT',1000,NULL,NULL,NULL),
('92000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','ELECTRICITY',100,'90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002');

INSERT INTO payments(payment_id, tenancy_id, amount, source, verification, confirmed_at) VALUES
('a0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',1500,'MANUAL_TRANSFER','USER_RECORDED','2026-02-01T00:00:00Z'),
('a0000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001',500,'MANUAL_CASH','USER_RECORDED','2026-02-02T00:00:00Z');

INSERT INTO receipts(receipt_id, payment_id, status, issued_at) VALUES
('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','ISSUED','2026-02-01T00:05:00Z');

INSERT INTO receipts(receipt_id, payment_id, status, issued_at, voided_at) VALUES
('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','VOIDED','2026-02-02T00:05:00Z','2026-02-02T00:06:00Z');

INSERT INTO deposits(deposit_id, tenancy_id) VALUES
('c0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001');

INSERT INTO deposit_payment_applications(deposit_payment_application_id, payment_id, deposit_id, applied_amount, applied_at) VALUES
('c1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',500,'2026-02-01T00:10:00Z');

INSERT INTO deposit_settlements(deposit_settlement_id, deposit_id, refunded_amount, retained_amount, reason_or_note, acted_by_user_id, settled_at) VALUES
('c2000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',400,100,'settled','00000000-0000-0000-0000-000000000001','2026-12-31T00:00:00Z');

INSERT INTO deposit_events(deposit_event_id, deposit_id, event_type, amount, occurred_at, payment_application_id, settlement_id) VALUES
('c3000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','RECEIVED',500,'2026-02-01T00:11:00Z','c1000000-0000-0000-0000-000000000001',NULL),
('c3000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','REFUNDED',400,'2026-12-31T00:01:00Z',NULL,'c2000000-0000-0000-0000-000000000001');

INSERT INTO reviews(review_id, tenancy_id, property_id, author_user_id, author_participant_id, overall_rating, comment, created_at) VALUES
('d0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000002',4,'ok','2026-01-02T00:00:00Z');

SELECT pg_temp.expect_constraint_failure('second current listing', $$
INSERT INTO listings(listing_id, room_id, status, public_title, public_description, public_price_projection, public_location_projection)
VALUES ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','DRAFT','dup','dup',900,ST_GeogFromText('SRID=4326;POINT(106.7 10.8)'))$$);

SELECT pg_temp.expect_constraint_failure('second nonterminal tenancy', $$
INSERT INTO tenancies(tenancy_id, room_id, status) VALUES
('50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','DRAFT')$$);

SELECT pg_temp.expect_constraint_failure('second active primary', $$
INSERT INTO tenancy_participants(tenancy_participant_id, tenancy_id, user_id, role, joined_at)
VALUES ('60000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','PRIMARY','2026-01-02T00:00:00Z')$$);

SELECT pg_temp.expect_constraint_failure('second issued receipt', $$
INSERT INTO receipts(receipt_id, payment_id, status, issued_at)
VALUES ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','ISSUED','2026-02-01T00:06:00Z')$$);

SELECT pg_temp.expect_constraint_failure('trust report no target', $$
INSERT INTO trust_reports(trust_report_id, reason, status, created_at)
VALUES ('e0000000-0000-0000-0000-000000000001','SPAM','SUBMITTED','2026-01-01T00:00:00Z')$$);

SELECT pg_temp.expect_constraint_failure('trust report two targets', $$
INSERT INTO trust_reports(trust_report_id, listing_id, review_id, reason, status, created_at)
VALUES ('e0000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','SPAM','SUBMITTED','2026-01-01T00:00:00Z')$$);

SELECT pg_temp.expect_constraint_failure('deposit received missing application', $$
INSERT INTO deposit_events(deposit_event_id, deposit_id, event_type, amount, occurred_at)
VALUES ('c3000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','RECEIVED',10,'2026-02-03T00:00:00Z')$$);

SELECT pg_temp.expect_constraint_failure('payment replacement self reference', $$
INSERT INTO payments(payment_id, tenancy_id, amount, source, verification, confirmed_at, voided_or_reversed_at, replacement_payment_id)
VALUES ('a0000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000001',10,'MANUAL_CASH','USER_RECORDED','2026-02-10T00:00:00Z','2026-02-10T00:01:00Z','a0000000-0000-0000-0000-000000000010')$$);

SELECT pg_temp.expect_constraint_failure('payment replacement requires void', $$
INSERT INTO payments(payment_id, tenancy_id, amount, source, verification, confirmed_at, replacement_payment_id)
VALUES ('a0000000-0000-0000-0000-000000000011','50000000-0000-0000-0000-000000000001',10,'MANUAL_CASH','USER_RECORDED','2026-02-10T00:00:00Z','a0000000-0000-0000-0000-000000000001')$$);

INSERT INTO payments(payment_id, tenancy_id, amount, source, verification, confirmed_at, voided_or_reversed_at, replacement_payment_id)
VALUES ('a0000000-0000-0000-0000-000000000012','50000000-0000-0000-0000-000000000001',10,'MANUAL_CASH','USER_RECORDED','2026-02-10T00:00:00Z','2026-02-10T00:01:00Z','a0000000-0000-0000-0000-000000000001');

SELECT pg_temp.expect_constraint_failure('payment replacement unique predecessor', $$
INSERT INTO payments(payment_id, tenancy_id, amount, source, verification, confirmed_at, voided_or_reversed_at, replacement_payment_id)
VALUES ('a0000000-0000-0000-0000-000000000013','50000000-0000-0000-0000-000000000001',10,'MANUAL_CASH','USER_RECORDED','2026-02-10T00:00:00Z','2026-02-10T00:01:00Z','a0000000-0000-0000-0000-000000000001')$$);

SELECT pg_temp.expect_constraint_failure('receipt replacement self reference', $$
INSERT INTO receipts(receipt_id, payment_id, status, issued_at, voided_at, replacement_receipt_id)
VALUES ('b0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000002','VOIDED','2026-02-03T00:00:00Z','2026-02-03T00:01:00Z','b0000000-0000-0000-0000-000000000010')$$);

SELECT pg_temp.expect_constraint_failure('receipt replacement requires void predecessor', $$
INSERT INTO receipts(receipt_id, payment_id, status, issued_at, replacement_receipt_id)
VALUES ('b0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000002','ISSUED','2026-02-03T00:00:00Z','b0000000-0000-0000-0000-000000000002')$$);

SELECT pg_temp.expect_constraint_failure('rent charge cannot carry utility fields', $$
INSERT INTO charges(charge_id, billing_cycle_id, charge_type, amount, utility_connection_id)
VALUES ('92000000-0000-0000-0000-000000000010','80000000-0000-0000-0000-000000000001','RENT',10,'90000000-0000-0000-0000-000000000001')$$);

SELECT pg_temp.expect_constraint_failure('meter reading requires connection', $$
INSERT INTO charges(charge_id, billing_cycle_id, charge_type, amount, start_meter_reading_id)
VALUES ('92000000-0000-0000-0000-000000000011','80000000-0000-0000-0000-000000000001','ELECTRICITY',10,'91000000-0000-0000-0000-000000000001')$$);

SELECT pg_temp.expect_constraint_failure('tenancy notice acknowledgement pair mismatch', $$
INSERT INTO tenancy_notices(tenancy_notice_id, tenancy_id, notice_type, issued_by_user_id, content_or_note, issued_at, acknowledged_by_user_id)
VALUES ('f0000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','MOVE_OUT','00000000-0000-0000-0000-000000000001','note','2026-03-01T00:00:00Z','00000000-0000-0000-0000-000000000002')$$);

SELECT pg_temp.expect_constraint_failure('payment claim review pair mismatch', $$
INSERT INTO payment_claims(payment_claim_id, tenancy_id, submitted_by_user_id, claimed_amount, status, submitted_at, reviewed_by_user_id)
VALUES ('f1000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',10,'SUBMITTED','2026-03-01T00:00:00Z','00000000-0000-0000-0000-000000000001')$$);

INSERT INTO tenancy_notices(tenancy_notice_id, tenancy_id, notice_type, issued_by_user_id, content_or_note, issued_at, acknowledged_by_user_id, acknowledged_at)
VALUES ('f0000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','MOVE_OUT','00000000-0000-0000-0000-000000000001','ok','2026-03-01T00:00:00Z','00000000-0000-0000-0000-000000000002','2026-03-02T00:00:00Z');

INSERT INTO payment_claims(payment_claim_id, tenancy_id, submitted_by_user_id, claimed_amount, status, submitted_at, reviewed_by_user_id, reviewed_at)
VALUES ('f1000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',10,'SUBMITTED','2026-03-01T00:00:00Z','00000000-0000-0000-0000-000000000001','2026-03-02T00:00:00Z');

SELECT 'PHYSICAL_CONTRACT_SCHEMA_SMOKE_PASS';

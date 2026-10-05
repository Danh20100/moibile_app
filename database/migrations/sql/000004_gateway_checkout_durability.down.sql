-- Disposable databases only: removes durable replay and correlation evidence.
DROP TRIGGER preserve_checkout_intent ON gateway.gateway_checkouts;
DROP FUNCTION gateway.preserve_checkout_intent();
ALTER TABLE gateway.gateway_checkouts
 DROP CONSTRAINT ck_gateway_checkouts_status,
 DROP CONSTRAINT ck_gateway_checkout_result,
 DROP CONSTRAINT ck_gateway_checkout_money,
 DROP CONSTRAINT ck_gateway_checkout_snapshot,
 DROP CONSTRAINT ck_gateway_checkout_legacy,
 DROP CONSTRAINT ck_gateway_checkout_trans,
 DROP CONSTRAINT ck_gateway_checkout_lease,
 DROP CONSTRAINT ck_gateway_checkout_stage,
 DROP CONSTRAINT uq_gateway_checkout_client_key,
 DROP CONSTRAINT uq_gateway_checkout_provider_request,
 DROP CONSTRAINT uq_gateway_checkout_provider_order,
 DROP CONSTRAINT uq_gateway_checkout_provider_trans;
UPDATE gateway.gateway_checkouts SET status='CREATED' WHERE status IN ('INITIATED','UNKNOWN');
ALTER TABLE gateway.gateway_checkouts
 ADD CONSTRAINT ck_gateway_checkouts_status CHECK (status IN ('CREATED','FAILED','EXPIRED','SUCCEEDED')),
 DROP COLUMN idempotency_key, DROP COLUMN fingerprint, DROP COLUMN request_snapshot,
 DROP COLUMN provider_partner_code, DROP COLUMN first_dispatch_at, DROP COLUMN dispatch_lease_owner,
 DROP COLUMN dispatch_lease_until, DROP COLUMN replay_blocker, DROP COLUMN provider_outcome,
 DROP COLUMN provider_result_code, DROP COLUMN provider_outcome_stage, DROP COLUMN terminal_evidence,
 DROP COLUMN provider_trans_id;

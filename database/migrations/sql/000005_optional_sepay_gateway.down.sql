DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM gateway.gateway_checkouts WHERE provider='SEPAY') THEN
    RAISE EXCEPTION 'Cannot roll back while SEPAY checkout rows exist' USING ERRCODE='23514';
  END IF;
END $$;

ALTER TABLE gateway.gateway_checkouts
  DROP CONSTRAINT ck_gateway_checkouts_provider,
  DROP CONSTRAINT ck_gateway_checkout_snapshot,
  DROP CONSTRAINT ck_gateway_checkout_trans,
  DROP CONSTRAINT ck_gateway_checkout_remote,
  DROP CONSTRAINT ck_gateway_checkout_stage,
  DROP CONSTRAINT ck_gateway_checkout_sepay_code,
  DROP CONSTRAINT ck_gateway_checkout_handoff,
  DROP CONSTRAINT ck_gateway_checkout_sepay_lease,
  DROP CONSTRAINT uq_gateway_checkout_remote_order,
  DROP COLUMN provider_remote_order_id,
  DROP COLUMN handoff_claimed_at,
  DROP COLUMN handoff_attempt;

ALTER TABLE gateway.gateway_checkouts
  ADD CONSTRAINT ck_gateway_checkouts_provider CHECK (provider='MOMO'),
  ADD CONSTRAINT ck_gateway_checkout_snapshot CHECK (request_snapshot IS NULL OR
    (jsonb_typeof(request_snapshot)='object' AND request_snapshot->>'requestType'='captureWallet'
     AND request_snapshot->'autoCapture'='true'::jsonb AND request_snapshot->>'partnerCode'=provider_partner_code
     AND request_snapshot ?& ARRAY['partnerCode','endpoint','ipnUrl','redirectUrl','extraData','requestType','autoCapture']
     AND request_snapshot - ARRAY['partnerCode','endpoint','ipnUrl','redirectUrl','extraData','requestType','autoCapture'] = '{}'::jsonb
     AND idempotency_key IS NOT NULL AND fingerprint IS NOT NULL AND provider_partner_code IS NOT NULL) IS TRUE),
  ADD CONSTRAINT ck_gateway_checkout_trans CHECK (provider_trans_id IS NULL OR provider_trans_id ~ '^[1-9][0-9]*$'),
  ADD CONSTRAINT ck_gateway_checkout_stage CHECK (provider_outcome_stage IN ('CREATE','PAYMENT_IPN'));

CREATE OR REPLACE FUNCTION gateway.preserve_checkout_intent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.checkout_id,NEW.tenancy_id,NEW.created_by_user_id,NEW.amount,NEW.reference_code,NEW.provider,
    NEW.provider_order_id,NEW.provider_request_id,NEW.idempotency_key,NEW.fingerprint,NEW.request_snapshot,NEW.provider_partner_code,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.checkout_id,OLD.tenancy_id,OLD.created_by_user_id,OLD.amount,OLD.reference_code,OLD.provider,
    OLD.provider_order_id,OLD.provider_request_id,OLD.idempotency_key,OLD.fingerprint,OLD.request_snapshot,OLD.provider_partner_code,OLD.created_at)
    OR (OLD.first_dispatch_at IS NOT NULL AND NEW.first_dispatch_at IS DISTINCT FROM OLD.first_dispatch_at) THEN
    RAISE EXCEPTION 'Gateway checkout intent is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

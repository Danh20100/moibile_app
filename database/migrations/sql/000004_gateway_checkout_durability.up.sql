ALTER TABLE gateway.gateway_checkouts
  ADD COLUMN idempotency_key uuid,
  ADD COLUMN fingerprint text,
  ADD COLUMN request_snapshot jsonb,
  ADD COLUMN provider_partner_code text,
  ADD COLUMN first_dispatch_at timestamptz,
  ADD COLUMN dispatch_lease_owner uuid,
  ADD COLUMN dispatch_lease_until timestamptz,
  ADD COLUMN replay_blocker text,
  ADD COLUMN provider_outcome text,
  ADD COLUMN provider_result_code integer,
  ADD COLUMN provider_outcome_stage text,
  ADD COLUMN terminal_evidence text,
  ADD COLUMN provider_trans_id text;

-- Legacy correlation and payment links survive; missing request data is never reconstructed.
ALTER TABLE gateway.gateway_checkouts DROP CONSTRAINT ck_gateway_checkouts_status;
UPDATE gateway.gateway_checkouts SET replay_blocker='LEGACY_RECONCILIATION_REQUIRED',
  status=CASE WHEN status='EXPIRED' THEN 'UNKNOWN' ELSE status END;
ALTER TABLE gateway.gateway_checkouts
  ADD CONSTRAINT ck_gateway_checkouts_status CHECK (status IN ('INITIATED','CREATED','UNKNOWN','FAILED','SUCCEEDED')),
  ADD CONSTRAINT ck_gateway_checkout_result CHECK ((status='SUCCEEDED') = (resulting_payment_id IS NOT NULL)),
  ADD CONSTRAINT ck_gateway_checkout_money CHECK (request_snapshot IS NULL OR (amount=trunc(amount) AND amount BETWEEN 1000 AND 50000000)),
  ADD CONSTRAINT ck_gateway_checkout_snapshot CHECK (request_snapshot IS NULL OR
    (jsonb_typeof(request_snapshot)='object' AND request_snapshot->>'requestType'='captureWallet'
     AND request_snapshot->'autoCapture'='true'::jsonb AND request_snapshot->>'partnerCode'=provider_partner_code
     AND request_snapshot ?& ARRAY['partnerCode','endpoint','ipnUrl','redirectUrl','extraData','requestType','autoCapture']
     AND request_snapshot - ARRAY['partnerCode','endpoint','ipnUrl','redirectUrl','extraData','requestType','autoCapture'] = '{}'::jsonb
     AND idempotency_key IS NOT NULL AND fingerprint IS NOT NULL AND provider_partner_code IS NOT NULL) IS TRUE),
  ADD CONSTRAINT ck_gateway_checkout_legacy CHECK (request_snapshot IS NOT NULL OR replay_blocker IS NOT DISTINCT FROM 'LEGACY_RECONCILIATION_REQUIRED'),
  ADD CONSTRAINT ck_gateway_checkout_trans CHECK (provider_trans_id IS NULL OR provider_trans_id ~ '^[1-9][0-9]*$'),
  ADD CONSTRAINT ck_gateway_checkout_lease CHECK ((dispatch_lease_owner IS NULL) = (dispatch_lease_until IS NULL)),
  ADD CONSTRAINT ck_gateway_checkout_stage CHECK (provider_outcome_stage IN ('CREATE','PAYMENT_IPN')),
  ADD CONSTRAINT uq_gateway_checkout_client_key UNIQUE (created_by_user_id,idempotency_key),
  ADD CONSTRAINT uq_gateway_checkout_provider_request UNIQUE (provider,provider_partner_code,provider_request_id),
  ADD CONSTRAINT uq_gateway_checkout_provider_order UNIQUE (provider,provider_partner_code,provider_order_id),
  ADD CONSTRAINT uq_gateway_checkout_provider_trans UNIQUE (provider,provider_partner_code,provider_trans_id);

CREATE FUNCTION gateway.preserve_checkout_intent() RETURNS trigger LANGUAGE plpgsql AS $$
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
CREATE TRIGGER preserve_checkout_intent BEFORE UPDATE ON gateway.gateway_checkouts
  FOR EACH ROW EXECUTE FUNCTION gateway.preserve_checkout_intent();

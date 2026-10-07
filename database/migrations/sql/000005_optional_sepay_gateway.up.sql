ALTER TABLE gateway.gateway_checkouts
  ADD COLUMN provider_remote_order_id text,
  ADD COLUMN handoff_claimed_at timestamptz,
  ADD COLUMN handoff_attempt integer NOT NULL DEFAULT 0,
  DROP CONSTRAINT ck_gateway_checkouts_provider,
  DROP CONSTRAINT ck_gateway_checkout_snapshot,
  DROP CONSTRAINT ck_gateway_checkout_trans,
  DROP CONSTRAINT ck_gateway_checkout_stage;

ALTER TABLE gateway.gateway_checkouts
  ADD CONSTRAINT ck_gateway_checkouts_provider CHECK (provider IN ('MOMO','SEPAY')),
  ADD CONSTRAINT ck_gateway_checkout_snapshot CHECK (request_snapshot IS NULL OR
    (CASE provider WHEN 'MOMO' THEN
      jsonb_typeof(request_snapshot)='object' AND request_snapshot->>'requestType'='captureWallet'
      AND request_snapshot->'autoCapture'='true'::jsonb AND request_snapshot->>'partnerCode'=provider_partner_code
      AND request_snapshot ?& ARRAY['partnerCode','endpoint','ipnUrl','redirectUrl','extraData','requestType','autoCapture']
      AND request_snapshot - ARRAY['partnerCode','endpoint','ipnUrl','redirectUrl','extraData','requestType','autoCapture'] = '{}'::jsonb
    WHEN 'SEPAY' THEN
      -- Fixed local Sandbox storage policy; this does not prove provider acceptance.
      jsonb_typeof(request_snapshot)='object'
      AND request_snapshot ?& ARRAY['environment','merchantId','endpoint','apiOrigin','operation','paymentMethod','currency','successUrl','errorUrl','cancelUrl']
      AND request_snapshot - ARRAY['environment','merchantId','endpoint','apiOrigin','operation','paymentMethod','currency','successUrl','errorUrl','cancelUrl'] = '{}'::jsonb
      AND request_snapshot->'environment'='"sandbox"'::jsonb
      AND jsonb_typeof(request_snapshot->'merchantId')='string'
      AND length(request_snapshot->>'merchantId') BETWEEN 1 AND 255
      AND provider_partner_code='sandbox:' || (request_snapshot->>'merchantId')
      AND request_snapshot->'endpoint'='"https://pay-sandbox.sepay.vn/v1/checkout/init"'::jsonb
      AND request_snapshot->'apiOrigin'='"https://pgapi-sandbox.sepay.vn"'::jsonb
      AND request_snapshot->'operation'='"PURCHASE"'::jsonb
      AND request_snapshot->'paymentMethod'='"BANK_TRANSFER"'::jsonb
      AND request_snapshot->'currency'='"VND"'::jsonb
      AND jsonb_typeof(request_snapshot->'successUrl')='string' AND request_snapshot->>'successUrl' ~ '^https://[^/?#[:space:]]+/'
      AND jsonb_typeof(request_snapshot->'errorUrl')='string' AND request_snapshot->>'errorUrl' ~ '^https://[^/?#[:space:]]+/'
      AND jsonb_typeof(request_snapshot->'cancelUrl')='string' AND request_snapshot->>'cancelUrl' ~ '^https://[^/?#[:space:]]+/'
    ELSE false END AND idempotency_key IS NOT NULL AND fingerprint IS NOT NULL AND provider_partner_code IS NOT NULL) IS TRUE),
  ADD CONSTRAINT ck_gateway_checkout_trans CHECK (provider_trans_id IS NULL OR
    CASE provider WHEN 'MOMO' THEN provider_trans_id ~ '^[1-9][0-9]*$'
    WHEN 'SEPAY' THEN provider_partner_code IS NOT NULL AND btrim(provider_trans_id) <> '' AND length(provider_trans_id) <= 255 ELSE false END),
  ADD CONSTRAINT ck_gateway_checkout_remote CHECK (provider_remote_order_id IS NULL OR
    (provider='SEPAY' AND provider_partner_code IS NOT NULL AND btrim(provider_remote_order_id) <> '' AND length(provider_remote_order_id) <= 255)),
  ADD CONSTRAINT ck_gateway_checkout_stage CHECK (provider_outcome_stage IN ('CREATE','PAYMENT_IPN','RECONCILIATION')),
  ADD CONSTRAINT ck_gateway_checkout_sepay_code CHECK (provider <> 'SEPAY' OR provider_result_code IS NULL),
  ADD CONSTRAINT ck_gateway_checkout_handoff CHECK (handoff_attempt >= 0 AND
    ((handoff_attempt=0 AND handoff_claimed_at IS NULL) OR (provider='SEPAY' AND handoff_attempt>0 AND handoff_claimed_at IS NOT NULL AND first_dispatch_at IS NOT NULL))),
  ADD CONSTRAINT ck_gateway_checkout_sepay_lease CHECK (provider <> 'SEPAY' OR dispatch_lease_owner IS NULL),
  ADD CONSTRAINT uq_gateway_checkout_remote_order UNIQUE (provider,provider_partner_code,provider_remote_order_id);

CREATE OR REPLACE FUNCTION gateway.preserve_checkout_intent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.checkout_id,NEW.tenancy_id,NEW.created_by_user_id,NEW.amount,NEW.reference_code,NEW.provider,
    NEW.provider_order_id,NEW.provider_request_id,NEW.idempotency_key,NEW.fingerprint,NEW.request_snapshot,NEW.provider_partner_code,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.checkout_id,OLD.tenancy_id,OLD.created_by_user_id,OLD.amount,OLD.reference_code,OLD.provider,
    OLD.provider_order_id,OLD.provider_request_id,OLD.idempotency_key,OLD.fingerprint,OLD.request_snapshot,OLD.provider_partner_code,OLD.created_at)
    OR (OLD.first_dispatch_at IS NOT NULL AND NEW.first_dispatch_at IS DISTINCT FROM OLD.first_dispatch_at)
    OR (OLD.provider_remote_order_id IS NOT NULL AND NEW.provider_remote_order_id IS DISTINCT FROM OLD.provider_remote_order_id)
    OR (OLD.handoff_claimed_at IS NOT NULL AND NEW.handoff_claimed_at IS DISTINCT FROM OLD.handoff_claimed_at) THEN
    RAISE EXCEPTION 'Gateway checkout intent is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.handoff_attempt IS DISTINCT FROM OLD.handoff_attempt THEN
    IF OLD.provider <> 'SEPAY' OR OLD.status NOT IN ('INITIATED','CREATED','UNKNOWN') OR OLD.request_snapshot IS NULL
      OR NEW.handoff_attempt::bigint <> OLD.handoff_attempt::bigint+1 OR NEW.status <> 'UNKNOWN'
      OR NEW.handoff_claimed_at IS NULL OR NEW.first_dispatch_at IS NULL THEN
      RAISE EXCEPTION 'Invalid gateway handoff attempt' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.handoff_claimed_at IS DISTINCT FROM OLD.handoff_claimed_at THEN
    RAISE EXCEPTION 'Gateway handoff claim requires an attempt' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

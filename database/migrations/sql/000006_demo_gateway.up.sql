ALTER TABLE gateway.gateway_checkouts
  DROP CONSTRAINT ck_gateway_checkouts_provider,
  DROP CONSTRAINT ck_gateway_checkout_snapshot,
  DROP CONSTRAINT ck_gateway_checkout_trans,
  DROP CONSTRAINT ck_gateway_checkout_stage,
  DROP CONSTRAINT ck_gateway_checkout_legacy;

ALTER TABLE gateway.gateway_checkouts
  ADD CONSTRAINT ck_gateway_checkouts_provider CHECK (provider IN ('MOMO','SEPAY','DEMO')),
  ADD CONSTRAINT ck_gateway_checkout_snapshot CHECK (CASE WHEN provider='DEMO' THEN request_snapshot IS NULL ELSE request_snapshot IS NULL OR
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
    ELSE false END AND idempotency_key IS NOT NULL AND fingerprint IS NOT NULL AND provider_partner_code IS NOT NULL) IS TRUE END),
  ADD CONSTRAINT ck_gateway_checkout_trans CHECK (provider_trans_id IS NULL OR
    CASE provider WHEN 'MOMO' THEN provider_trans_id ~ '^[1-9][0-9]*$'
    WHEN 'SEPAY' THEN provider_partner_code IS NOT NULL AND btrim(provider_trans_id) <> '' AND length(provider_trans_id) <= 255
    WHEN 'DEMO' THEN provider_trans_id='DEMO-' || replace(checkout_id::text,'-','') ELSE false END),
  ADD CONSTRAINT ck_gateway_checkout_stage CHECK (CASE WHEN provider='DEMO' THEN provider_outcome_stage IN ('CREATE','DEMO_CONFIRMATION') ELSE provider_outcome_stage IN ('CREATE','PAYMENT_IPN','RECONCILIATION') END),
  ADD CONSTRAINT ck_gateway_checkout_legacy CHECK (CASE WHEN provider='DEMO' THEN request_snapshot IS NULL ELSE (request_snapshot IS NOT NULL OR replay_blocker IS NOT DISTINCT FROM 'LEGACY_RECONCILIATION_REQUIRED') END);

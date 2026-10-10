DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM gateway.gateway_checkouts
    WHERE provider='SEPAY' AND request_snapshot->>'environment'='production'
  ) THEN
    RAISE EXCEPTION 'Cannot roll back while SePay production checkout rows exist';
  END IF;
END $$;

ALTER TABLE gateway.gateway_checkouts
  DROP CONSTRAINT ck_gateway_checkout_snapshot;

ALTER TABLE gateway.gateway_checkouts
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
    ELSE false END AND idempotency_key IS NOT NULL AND fingerprint IS NOT NULL AND provider_partner_code IS NOT NULL) IS TRUE END);

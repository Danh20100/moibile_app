-- Production hosts pinned 2026-10-09. Sandbox, MoMo, and Demo checks stay in place.
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
      jsonb_typeof(request_snapshot)='object'
      AND request_snapshot ?& ARRAY['environment','merchantId','endpoint','apiOrigin','operation','paymentMethod','currency','successUrl','errorUrl','cancelUrl']
      AND request_snapshot - ARRAY['environment','merchantId','endpoint','apiOrigin','operation','paymentMethod','currency','successUrl','errorUrl','cancelUrl'] = '{}'::jsonb
      AND jsonb_typeof(request_snapshot->'merchantId')='string'
      AND length(request_snapshot->>'merchantId') BETWEEN 1 AND 255
      AND request_snapshot->'operation'='"PURCHASE"'::jsonb
      AND request_snapshot->'paymentMethod'='"BANK_TRANSFER"'::jsonb
      AND request_snapshot->'currency'='"VND"'::jsonb
      AND jsonb_typeof(request_snapshot->'successUrl')='string' AND request_snapshot->>'successUrl' ~ '^https://[^/?#[:space:]]+/'
      AND jsonb_typeof(request_snapshot->'errorUrl')='string' AND request_snapshot->>'errorUrl' ~ '^https://[^/?#[:space:]]+/'
      AND jsonb_typeof(request_snapshot->'cancelUrl')='string' AND request_snapshot->>'cancelUrl' ~ '^https://[^/?#[:space:]]+/'
      AND (
        (
          request_snapshot->'environment'='"sandbox"'::jsonb
          AND provider_partner_code='sandbox:' || (request_snapshot->>'merchantId')
          AND request_snapshot->'endpoint'='"https://pay-sandbox.sepay.vn/v1/checkout/init"'::jsonb
          AND request_snapshot->'apiOrigin'='"https://pgapi-sandbox.sepay.vn"'::jsonb
        ) OR (
          request_snapshot->'environment'='"production"'::jsonb
          AND provider_partner_code='production:' || (request_snapshot->>'merchantId')
          AND request_snapshot->'endpoint'='"https://pay.sepay.vn/v1/checkout/init"'::jsonb
          AND request_snapshot->'apiOrigin'='"https://pgapi.sepay.vn"'::jsonb
        )
      )
    ELSE false END AND idempotency_key IS NOT NULL AND fingerprint IS NOT NULL AND provider_partner_code IS NOT NULL) IS TRUE END);

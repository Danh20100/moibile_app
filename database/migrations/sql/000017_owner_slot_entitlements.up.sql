CREATE TABLE owner_slot_checkouts (
  checkout_id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users (user_id),
  purchase_id uuid NOT NULL UNIQUE,
  idempotency_key uuid NOT NULL,
  amount numeric(14,2) NOT NULL,
  status text NOT NULL,
  provider_order_id text NOT NULL UNIQUE,
  provider_request_id text NOT NULL,
  provider_partner_code text NOT NULL,
  reference_code text NOT NULL,
  request_snapshot jsonb NOT NULL,
  fingerprint text NOT NULL,
  pay_url text,
  handoff_attempt integer NOT NULL DEFAULT 0,
  handoff_claimed_at timestamptz,
  provider_trans_id text,
  provider_remote_order_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uq_owner_slot_checkouts_client UNIQUE (owner_user_id, idempotency_key),
  CONSTRAINT ck_owner_slot_checkouts_amount CHECK (amount = 259000.00),
  CONSTRAINT ck_owner_slot_checkouts_status CHECK (status IN ('CREATED', 'UNKNOWN', 'FAILED', 'SUCCEEDED')),
  CONSTRAINT ck_owner_slot_checkouts_slot_ref CHECK (reference_code LIKE 'SLOT %')
);

CREATE TABLE owner_slot_entitlements (
  entitlement_id uuid PRIMARY KEY,
  checkout_id uuid NOT NULL UNIQUE REFERENCES owner_slot_checkouts (checkout_id),
  owner_user_id uuid NOT NULL REFERENCES users (user_id),
  purchase_id uuid NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL,
  status text NOT NULL,
  valid_until timestamptz NOT NULL,
  provider_trans_id text NOT NULL UNIQUE,
  verified_at timestamptz NOT NULL,
  CONSTRAINT ck_owner_slot_entitlements_amount CHECK (amount = 259000.00),
  CONSTRAINT ck_owner_slot_entitlements_status CHECK (status = 'PROVIDER_VERIFIED')
);

-- Canonical mailbox identity. Gmail ignores dots and everything after '+' in the local part,
-- and googlemail.com is an alias of gmail.com, so those spellings all reach one inbox.
-- IMMUTABLE so callers may use it in indexes; input must already be normalized ASCII lower case.
CREATE FUNCTION trooi_canonical_email(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE
      WHEN split_part($1, '@', 2) IN ('gmail.com', 'googlemail.com')
        THEN replace(split_part(split_part($1, '@', 1), '+', 1), '.', '') || '@gmail.com'
      ELSE $1
    END
  $$;

CREATE TABLE identity_otp_challenges (
  challenge_id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('EMAIL_REGISTER')),
  destination_address text NOT NULL,
  destination_normalized text COLLATE "C" NOT NULL,
  code_hmac text NOT NULL CHECK (code_hmac ~ '^[a-f0-9]{64}$'),
  pending_password_hash text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_sent_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  superseded_at timestamptz,
  CONSTRAINT ck_identity_otp_challenges_window CHECK (expires_at > created_at),
  CONSTRAINT ck_identity_otp_challenges_attempts CHECK (attempts >= 0 AND max_attempts > 0),
  CONSTRAINT ck_identity_otp_challenges_address_present CHECK (
    length(destination_address) > 0 AND length(destination_normalized) > 0
  ),
  CONSTRAINT ck_identity_otp_challenges_key_ascii_lower CHECK (
    (destination_normalized COLLATE "C") !~ '[^!-~]' AND (destination_normalized COLLATE "C") !~ '[A-Z]'
  ),
  CONSTRAINT ck_identity_otp_challenges_hash CHECK (left(pending_password_hash, 10) = '$argon2id$')
);

-- One live challenge per mailbox: a pending 'a.b@gmail.com' and 'ab@gmail.com' are the same person.
CREATE UNIQUE INDEX uq_identity_otp_challenges_live
  ON identity_otp_challenges (purpose, trooi_canonical_email(destination_normalized))
  WHERE consumed_at IS NULL AND superseded_at IS NULL;

CREATE INDEX identity_otp_challenges_expiry ON identity_otp_challenges (expires_at);

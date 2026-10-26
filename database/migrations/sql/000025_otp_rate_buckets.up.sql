CREATE TABLE identity_otp_rate_buckets (
  bucket_key char(64) NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  expires_at timestamptz NOT NULL CHECK (expires_at > window_start),
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX ix_identity_otp_rate_buckets_expiry ON identity_otp_rate_buckets(expires_at);

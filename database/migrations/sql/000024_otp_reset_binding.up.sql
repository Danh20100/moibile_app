-- Existing recovery codes have no identity snapshot and must not survive this upgrade.
UPDATE identity_otp_challenges SET superseded_at = clock_timestamp()
WHERE purpose = 'PASSWORD_RESET' AND consumed_at IS NULL AND superseded_at IS NULL;
ALTER TABLE identity_otp_challenges
  ADD COLUMN reset_user_id uuid,
  ADD COLUMN reset_email_revision bigint,
  ADD COLUMN reset_credential_revision bigint;
UPDATE identity_otp_challenges SET attempts = least(attempts, max_attempts);
ALTER TABLE identity_otp_challenges ADD CONSTRAINT ck_identity_otp_attempt_budget CHECK (attempts <= max_attempts);
CREATE INDEX identity_otp_challenges_latest_mailbox
  ON identity_otp_challenges (purpose, trooi_canonical_email(destination_normalized), created_at DESC);

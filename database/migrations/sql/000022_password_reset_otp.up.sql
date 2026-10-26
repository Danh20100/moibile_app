-- Password-reset challenges share identity_otp_challenges with registration.
-- One live row per (purpose, mailbox); a reset must not block a pending registration.
ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT identity_otp_challenges_purpose_check;

ALTER TABLE identity_otp_challenges
  ADD CONSTRAINT identity_otp_challenges_purpose_check
  CHECK (purpose IN ('EMAIL_REGISTER', 'PASSWORD_RESET'));

ALTER TABLE identity_otp_challenges
  ALTER COLUMN pending_password_hash DROP NOT NULL;

ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT ck_identity_otp_challenges_hash;

ALTER TABLE identity_otp_challenges
  ADD CONSTRAINT ck_identity_otp_challenges_hash
  CHECK (pending_password_hash IS NULL OR left(pending_password_hash, 10) = '$argon2id$');

ALTER TABLE identity_otp_challenges
  ADD CONSTRAINT ck_identity_otp_challenges_purpose_hash
  CHECK (
    (purpose = 'EMAIL_REGISTER' AND pending_password_hash IS NOT NULL)
    OR (purpose = 'PASSWORD_RESET' AND pending_password_hash IS NULL)
  );

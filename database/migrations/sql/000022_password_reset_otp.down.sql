DELETE FROM identity_otp_challenges WHERE purpose = 'PASSWORD_RESET';

ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT ck_identity_otp_challenges_purpose_hash;

ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT ck_identity_otp_challenges_hash;

ALTER TABLE identity_otp_challenges
  ALTER COLUMN pending_password_hash SET NOT NULL;

ALTER TABLE identity_otp_challenges
  ADD CONSTRAINT ck_identity_otp_challenges_hash
  CHECK (left(pending_password_hash, 10) = '$argon2id$');

ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT identity_otp_challenges_purpose_check;

ALTER TABLE identity_otp_challenges
  ADD CONSTRAINT identity_otp_challenges_purpose_check
  CHECK (purpose IN ('EMAIL_REGISTER'));

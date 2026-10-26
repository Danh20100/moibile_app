DROP INDEX identity_otp_challenges_latest_mailbox;
ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT ck_identity_otp_attempt_budget,
  DROP COLUMN reset_user_id,
  DROP COLUMN reset_email_revision,
  DROP COLUMN reset_credential_revision;

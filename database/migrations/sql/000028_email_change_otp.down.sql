DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM identity_otp_challenges WHERE purpose = 'EMAIL_CHANGE') OR
     EXISTS (SELECT 1 FROM identity_security_events WHERE event_code = 'EMAIL_CHANGED') THEN
    RAISE EXCEPTION 'Email change challenges or audit events exist; preserve them and roll back application code only.';
  END IF;
END $$;

ALTER TABLE identity_security_events
  DROP CONSTRAINT identity_security_events_event_code_check,
  ADD CONSTRAINT identity_security_events_event_code_check CHECK (event_code IN (
    'CHALLENGE_ISSUED', 'CHALLENGE_REJECTED', 'REGISTRATION_SUCCEEDED', 'REGISTRATION_REJECTED',
    'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REFRESH_REUSE', 'SESSION_REFRESH_REJECTED',
    'AUTHENTICATION_REJECTED', 'SESSION_LOGOUT', 'SESSION_REVOKED', 'IDENTITY_COLLISION',
    'REAUTH_ISSUED', 'REAUTH_REJECTED', 'PASSWORD_INITIALIZED'
  ));

ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT ck_identity_otp_email_change_scope,
  DROP CONSTRAINT ck_identity_otp_challenges_purpose_hash,
  ADD CONSTRAINT ck_identity_otp_challenges_purpose_hash CHECK (
    (purpose = 'EMAIL_REGISTER' AND pending_password_hash IS NOT NULL) OR
    (purpose = 'PASSWORD_RESET' AND pending_password_hash IS NULL)
  ),
  DROP CONSTRAINT identity_otp_challenges_purpose_check,
  ADD CONSTRAINT identity_otp_challenges_purpose_check CHECK (purpose IN ('EMAIL_REGISTER', 'PASSWORD_RESET'));

ALTER TABLE identity_otp_challenges
  DROP COLUMN change_email_revision,
  DROP COLUMN change_email_id,
  DROP COLUMN change_session_id,
  DROP COLUMN change_user_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM identity_otp_challenges
    WHERE purpose = 'EMAIL_CHANGE' AND change_stage IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM identity_security_events WHERE event_code = 'EMAIL_CHANGE_NOTICE_FAILED'
  ) THEN
    RAISE EXCEPTION 'Staged email-change challenges or notice-failure audit events exist; preserve them and roll back application code only.';
  END IF;
END $$;

DROP INDEX ix_identity_otp_challenges_live_email_change_target;
DROP INDEX uq_identity_otp_challenges_live_email_change_user;

ALTER TABLE identity_security_events
  DROP CONSTRAINT identity_security_events_event_code_check,
  ADD CONSTRAINT identity_security_events_event_code_check CHECK (event_code IN (
    'CHALLENGE_ISSUED', 'CHALLENGE_REJECTED', 'REGISTRATION_SUCCEEDED', 'REGISTRATION_REJECTED',
    'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REFRESH_REUSE', 'SESSION_REFRESH_REJECTED',
    'AUTHENTICATION_REJECTED', 'SESSION_LOGOUT', 'SESSION_REVOKED', 'IDENTITY_COLLISION',
    'REAUTH_ISSUED', 'REAUTH_REJECTED', 'PASSWORD_INITIALIZED', 'EMAIL_CHANGED'
  ));

ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT ck_identity_otp_email_change_stage_scope,
  DROP COLUMN change_target_normalized,
  DROP COLUMN change_target_address,
  DROP COLUMN change_stage;

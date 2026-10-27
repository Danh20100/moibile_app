ALTER TABLE identity_otp_challenges
  ADD COLUMN change_user_id uuid REFERENCES users(user_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD COLUMN change_session_id uuid REFERENCES auth_sessions(session_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD COLUMN change_email_id uuid REFERENCES user_emails(user_email_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD COLUMN change_email_revision bigint;

ALTER TABLE identity_otp_challenges
  DROP CONSTRAINT identity_otp_challenges_purpose_check,
  ADD CONSTRAINT identity_otp_challenges_purpose_check
    CHECK (purpose IN ('EMAIL_REGISTER', 'PASSWORD_RESET', 'EMAIL_CHANGE')),
  DROP CONSTRAINT ck_identity_otp_challenges_purpose_hash,
  ADD CONSTRAINT ck_identity_otp_challenges_purpose_hash CHECK (
    (purpose = 'EMAIL_REGISTER' AND pending_password_hash IS NOT NULL) OR
    (purpose IN ('PASSWORD_RESET', 'EMAIL_CHANGE') AND pending_password_hash IS NULL)
  ),
  ADD CONSTRAINT ck_identity_otp_email_change_scope CHECK (
    (purpose = 'EMAIL_CHANGE' AND change_user_id IS NOT NULL AND change_session_id IS NOT NULL AND
      change_email_id IS NOT NULL AND change_email_revision IS NOT NULL) OR
    (purpose <> 'EMAIL_CHANGE' AND change_user_id IS NULL AND change_session_id IS NULL AND
      change_email_id IS NULL AND change_email_revision IS NULL)
  );

ALTER TABLE identity_security_events
  DROP CONSTRAINT identity_security_events_event_code_check,
  ADD CONSTRAINT identity_security_events_event_code_check CHECK (event_code IN (
    'CHALLENGE_ISSUED', 'CHALLENGE_REJECTED', 'REGISTRATION_SUCCEEDED', 'REGISTRATION_REJECTED',
    'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REFRESH_REUSE', 'SESSION_REFRESH_REJECTED',
    'AUTHENTICATION_REJECTED', 'SESSION_LOGOUT', 'SESSION_REVOKED', 'IDENTITY_COLLISION',
    'REAUTH_ISSUED', 'REAUTH_REJECTED', 'PASSWORD_INITIALIZED', 'EMAIL_CHANGED'
  ));

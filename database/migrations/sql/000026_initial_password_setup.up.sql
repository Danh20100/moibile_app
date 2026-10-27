ALTER TABLE identity_auth_challenges
  DROP CONSTRAINT identity_auth_challenges_purpose_check,
  ADD CONSTRAINT identity_auth_challenges_purpose_check
    CHECK (purpose IN ('LOGIN', 'REGISTER', 'REAUTH_ORGANIZATION_CREATE', 'INITIAL_PASSWORD_SETUP'));

ALTER TABLE identity_auth_challenges
  DROP CONSTRAINT ck_identity_auth_challenges_scope,
  ADD CONSTRAINT ck_identity_auth_challenges_scope CHECK (
    (purpose = 'LOGIN' AND user_id IS NULL AND session_id IS NULL) OR
    (purpose = 'REGISTER' AND user_id IS NULL AND session_id IS NULL) OR
    (purpose IN ('REAUTH_ORGANIZATION_CREATE', 'INITIAL_PASSWORD_SETUP') AND user_id IS NOT NULL AND session_id IS NOT NULL)
  );

ALTER TABLE identity_security_events
  DROP CONSTRAINT identity_security_events_event_code_check,
  ADD CONSTRAINT identity_security_events_event_code_check CHECK (event_code IN (
    'CHALLENGE_ISSUED', 'CHALLENGE_REJECTED', 'REGISTRATION_SUCCEEDED', 'REGISTRATION_REJECTED',
    'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REFRESH_REUSE', 'SESSION_REFRESH_REJECTED',
    'AUTHENTICATION_REJECTED', 'SESSION_LOGOUT', 'SESSION_REVOKED', 'IDENTITY_COLLISION',
    'REAUTH_ISSUED', 'REAUTH_REJECTED', 'PASSWORD_INITIALIZED'
  ));

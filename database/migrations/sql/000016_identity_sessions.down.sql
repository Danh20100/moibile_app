DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth_sessions) OR
     EXISTS (SELECT 1 FROM auth_session_refresh_history) OR
     EXISTS (SELECT 1 FROM identity_security_events) OR
     EXISTS (SELECT 1 FROM identity_auth_challenges) THEN
    RAISE EXCEPTION 'Migration 000016 contains Identity session/security data; preserve it and roll back application code only.';
  END IF;
END $$;

DROP TRIGGER tr_identity_security_events_guard ON identity_security_events;
DROP TRIGGER tr_auth_session_refresh_history_guard ON auth_session_refresh_history;
DROP TRIGGER tr_auth_sessions_guard ON auth_sessions;
DROP TRIGGER tr_identity_auth_challenges_guard ON identity_auth_challenges;
DROP FUNCTION identity_sessions_write_guard();
DROP TABLE identity_security_events;
DROP TABLE auth_session_refresh_history;
DROP TABLE identity_auth_challenges;
DROP TABLE auth_sessions;

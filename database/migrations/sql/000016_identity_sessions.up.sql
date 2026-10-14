CREATE TABLE identity_auth_challenges (
  challenge_id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('LOGIN', 'REGISTER', 'REAUTH_ORGANIZATION_CREATE')),
  nonce_sha256 text NOT NULL UNIQUE CHECK (nonce_sha256 ~ '^[a-f0-9]{64}$'),
  user_id uuid,
  session_id uuid,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT fk_identity_auth_challenges_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT ck_identity_auth_challenges_window CHECK (expires_at > created_at),
  CONSTRAINT ck_identity_auth_challenges_scope CHECK (
    (purpose = 'LOGIN' AND user_id IS NULL AND session_id IS NULL) OR
    (purpose = 'REGISTER' AND user_id IS NULL AND session_id IS NULL) OR
    (purpose = 'REAUTH_ORGANIZATION_CREATE' AND user_id IS NOT NULL AND session_id IS NOT NULL)
  )
);
CREATE INDEX identity_auth_challenges_expiry ON identity_auth_challenges (expires_at, consumed_at);

CREATE TABLE auth_sessions (
  session_id uuid PRIMARY KEY,
  family_id uuid NOT NULL,
  user_id uuid NOT NULL,
  access_token_sha256 text NOT NULL UNIQUE CHECK (access_token_sha256 ~ '^[a-f0-9]{64}$'),
  access_expires_at timestamptz NOT NULL,
  refresh_token_sha256 text NOT NULL UNIQUE CHECK (refresh_token_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  authenticated_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT ck_auth_sessions_expiry CHECK (
    access_expires_at > created_at AND idle_expires_at > created_at AND absolute_expires_at >= idle_expires_at
  ),
  CONSTRAINT ck_auth_sessions_revocation CHECK (
    (revoked_at IS NULL AND revoke_reason IS NULL) OR (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL)
  )
);
ALTER TABLE identity_auth_challenges
  ADD CONSTRAINT fk_identity_auth_challenges_session FOREIGN KEY (session_id)
  REFERENCES auth_sessions (session_id) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX auth_sessions_user_active ON auth_sessions (user_id, revoked_at, absolute_expires_at);
CREATE INDEX auth_sessions_family ON auth_sessions (family_id, revoked_at);

CREATE TABLE auth_session_refresh_history (
  refresh_token_sha256 text PRIMARY KEY CHECK (refresh_token_sha256 ~ '^[a-f0-9]{64}$'),
  session_id uuid NOT NULL,
  rotated_at timestamptz NOT NULL,
  CONSTRAINT fk_auth_session_refresh_history_session FOREIGN KEY (session_id)
    REFERENCES auth_sessions (session_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX auth_session_refresh_history_session ON auth_session_refresh_history (session_id);

CREATE TABLE identity_security_events (
  event_id uuid PRIMARY KEY,
  user_id uuid,
  session_id uuid,
  event_code text NOT NULL CHECK (event_code IN (
    'CHALLENGE_ISSUED', 'CHALLENGE_REJECTED', 'REGISTRATION_SUCCEEDED', 'REGISTRATION_REJECTED',
    'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REFRESH_REUSE', 'SESSION_LOGOUT',
    'SESSION_REVOKED', 'IDENTITY_COLLISION', 'REAUTH_ISSUED', 'REAUTH_REJECTED'
  )),
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'REJECTED')),
  occurred_at timestamptz NOT NULL,
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_metadata) = 'object'),
  CONSTRAINT fk_identity_security_events_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);
ALTER TABLE identity_security_events
  ADD CONSTRAINT fk_identity_security_events_session FOREIGN KEY (session_id)
  REFERENCES auth_sessions (session_id) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX identity_security_events_user_time ON identity_security_events (user_id, occurred_at);
CREATE INDEX identity_security_events_session_time ON identity_security_events (session_id, occurred_at);

CREATE FUNCTION identity_sessions_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Identity session/security history cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'identity_security_events' THEN
    RAISE EXCEPTION 'Identity security events are append-only' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'auth_sessions' AND (NEW.session_id IS DISTINCT FROM OLD.session_id OR
      NEW.family_id IS DISTINCT FROM OLD.family_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR
      NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.authenticated_at IS DISTINCT FROM OLD.authenticated_at) THEN
    RAISE EXCEPTION 'Identity session ownership and creation facts are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'auth_session_refresh_history' AND
     (NEW.refresh_token_sha256 IS DISTINCT FROM OLD.refresh_token_sha256 OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.rotated_at IS DISTINCT FROM OLD.rotated_at) THEN
    RAISE EXCEPTION 'Rotated refresh history is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'identity_auth_challenges' AND
     (NEW.challenge_id IS DISTINCT FROM OLD.challenge_id OR NEW.purpose IS DISTINCT FROM OLD.purpose OR
      NEW.nonce_sha256 IS DISTINCT FROM OLD.nonce_sha256 OR NEW.user_id IS DISTINCT FROM OLD.user_id OR
      NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR
      NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
      (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at)) THEN
    RAISE EXCEPTION 'Identity auth challenges are immutable except one-time consumption' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_identity_auth_challenges_guard BEFORE UPDATE OR DELETE ON identity_auth_challenges
  FOR EACH ROW EXECUTE FUNCTION identity_sessions_write_guard();
CREATE TRIGGER tr_auth_sessions_guard BEFORE UPDATE OR DELETE ON auth_sessions
  FOR EACH ROW EXECUTE FUNCTION identity_sessions_write_guard();
CREATE TRIGGER tr_auth_session_refresh_history_guard BEFORE UPDATE OR DELETE ON auth_session_refresh_history
  FOR EACH ROW EXECUTE FUNCTION identity_sessions_write_guard();
CREATE TRIGGER tr_identity_security_events_guard BEFORE UPDATE OR DELETE ON identity_security_events
  FOR EACH ROW EXECUTE FUNCTION identity_sessions_write_guard();

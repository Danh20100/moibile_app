ALTER TABLE identity_otp_challenges
  ADD COLUMN change_stage text,
  ADD COLUMN change_target_address text,
  ADD COLUMN change_target_normalized text;

-- Invalidate pending codes from the previous single-email change flow without deleting their audit records.
UPDATE identity_otp_challenges
SET superseded_at = clock_timestamp()
WHERE purpose = 'EMAIL_CHANGE'
  AND consumed_at IS NULL
  AND superseded_at IS NULL;

ALTER TABLE identity_otp_challenges
  ADD CONSTRAINT ck_identity_otp_email_change_stage_scope CHECK (
    (purpose = 'EMAIL_CHANGE' AND (
      (change_stage IN ('CURRENT_EMAIL', 'NEW_EMAIL')
        AND change_target_address IS NOT NULL AND btrim(change_target_address) <> ''
        AND char_length(change_target_address) <= 254
        AND change_target_normalized IS NOT NULL AND btrim(change_target_normalized) <> ''
        AND char_length(change_target_normalized) <= 254)
      OR
      (change_stage IS NULL AND change_target_address IS NULL AND change_target_normalized IS NULL
        AND (consumed_at IS NOT NULL OR superseded_at IS NOT NULL))
    )) OR
    (purpose <> 'EMAIL_CHANGE' AND change_stage IS NULL
      AND change_target_address IS NULL AND change_target_normalized IS NULL)
  );

CREATE UNIQUE INDEX uq_identity_otp_challenges_live_email_change_user
  ON identity_otp_challenges (change_user_id)
  WHERE purpose = 'EMAIL_CHANGE' AND consumed_at IS NULL AND superseded_at IS NULL;

CREATE INDEX ix_identity_otp_challenges_live_email_change_target
  ON identity_otp_challenges (change_target_normalized)
  WHERE purpose = 'EMAIL_CHANGE' AND change_stage = 'NEW_EMAIL'
    AND consumed_at IS NULL AND superseded_at IS NULL;

ALTER TABLE identity_security_events
  DROP CONSTRAINT identity_security_events_event_code_check,
  ADD CONSTRAINT identity_security_events_event_code_check CHECK (event_code IN (
    'CHALLENGE_ISSUED', 'CHALLENGE_REJECTED', 'REGISTRATION_SUCCEEDED', 'REGISTRATION_REJECTED',
    'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REFRESH_REUSE', 'SESSION_REFRESH_REJECTED',
    'AUTHENTICATION_REJECTED', 'SESSION_LOGOUT', 'SESSION_REVOKED', 'IDENTITY_COLLISION',
    'REAUTH_ISSUED', 'REAUTH_REJECTED', 'PASSWORD_INITIALIZED', 'EMAIL_CHANGED',
    'EMAIL_CHANGE_NOTICE_FAILED'
  ));

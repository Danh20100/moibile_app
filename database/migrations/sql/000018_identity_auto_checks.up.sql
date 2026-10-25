-- Additive, privacy-minimizing auto-KYC outcome ledger.
-- Raw CCCD and selfie bytes are processed transiently and are NOT persisted.
CREATE TABLE identity_auto_checks (
    attempt_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (user_id),
    state text NOT NULL,
    similarity numeric(6,5),
    reason_code text NOT NULL,
    consent_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    checked_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_identity_auto_checks_state CHECK (state IN ('AUTO_CHECK_PASSED', 'NEEDS_RETRY')),
    CONSTRAINT ck_identity_auto_checks_score CHECK (similarity IS NULL OR (similarity >= 0 AND similarity <= 1)),
    CONSTRAINT ck_identity_auto_checks_consent CHECK (consent_version = 'kyc-auto-v1')
);
CREATE INDEX idx_identity_auto_checks_user_created ON identity_auto_checks(user_id, created_at DESC);
COMMENT ON TABLE identity_auto_checks IS 'Automated face-similarity check receipts only; not government identity authentication, no raw ID documents or selfies retained.';

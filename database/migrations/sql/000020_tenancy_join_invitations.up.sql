CREATE TABLE tenancy_join_invitations (
  invitation_id uuid PRIMARY KEY,
  tenancy_id uuid NOT NULL REFERENCES tenancies(tenancy_id),
  participant_id uuid NOT NULL REFERENCES tenancy_participants(tenancy_participant_id),
  issued_by_user_id uuid NOT NULL REFERENCES users(user_id),
  token_hash char(64) NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_by_user_id uuid REFERENCES users(user_id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT ck_join_invitation_expiry CHECK (expires_at > issued_at),
  CONSTRAINT ck_join_invitation_acceptance CHECK ((accepted_at IS NULL) = (accepted_by_user_id IS NULL))
);
CREATE INDEX ix_tenancy_join_invitations_tenancy ON tenancy_join_invitations(tenancy_id, expires_at DESC);
CREATE UNIQUE INDEX uq_tenancy_join_invitation_active ON tenancy_join_invitations(tenancy_id)
  WHERE revoked_at IS NULL AND accepted_at IS NULL;

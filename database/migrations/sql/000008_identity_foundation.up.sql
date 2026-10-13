-- Frozen vnext.identity-foundation.1. Requires the combined integration chain through 000007.
DO $$ BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'Identity foundation requires combined integration migrations 000006 and 000007';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE name = '000006_demo_gateway')
     OR NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE name = '000007_sepay_production') THEN
    RAISE EXCEPTION 'Identity foundation requires combined integration migrations 000006 and 000007';
  END IF;
END $$;

CREATE TABLE auth_identities (
  auth_identity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  issuer text NOT NULL,
  subject text NOT NULL,
  linked_at timestamptz NOT NULL,
  CONSTRAINT pk_auth_identities PRIMARY KEY (auth_identity_id),
  CONSTRAINT fk_auth_identities_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT ck_auth_identities_google_principal CHECK (provider = 'google' AND issuer = 'https://accounts.google.com'),
  CONSTRAINT ck_auth_identities_subject_present CHECK (length(subject) > 0),
  CONSTRAINT uq_auth_identities_principal UNIQUE (provider, issuer, subject)
);

CREATE INDEX ix_auth_identities_user_id ON auth_identities USING btree (user_id);

CREATE TABLE user_emails (
  user_email_id uuid NOT NULL,
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  normalized_email text COLLATE "C" NOT NULL,
  verified_at timestamptz NOT NULL,
  verification_source text NOT NULL,
  email_revision bigint NOT NULL,
  CONSTRAINT pk_user_emails PRIMARY KEY (user_email_id),
  CONSTRAINT fk_user_emails_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT ck_user_emails_address_present CHECK (length(email_address) > 0 AND length(normalized_email) > 0),
  CONSTRAINT ck_user_emails_revision_positive CHECK (email_revision > 0),
  CONSTRAINT ck_user_emails_verification_source CHECK (verification_source IN ('google', 'email_otp')),
  CONSTRAINT ck_user_emails_key_ascii_lower CHECK ((normalized_email COLLATE "C") !~ '[^!-~]' AND (normalized_email COLLATE "C") !~ '[A-Z]'),
  CONSTRAINT uq_user_emails_user UNIQUE (user_id),
  CONSTRAINT uq_user_emails_address UNIQUE (normalized_email)
);

CREATE TABLE user_profiles (
  user_id uuid NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT pk_user_profiles PRIMARY KEY (user_id),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE password_credentials (
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  credential_revision bigint NOT NULL,
  created_at timestamptz NOT NULL,
  password_changed_at timestamptz NOT NULL,
  CONSTRAINT pk_password_credentials PRIMARY KEY (user_id),
  CONSTRAINT fk_password_credentials_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT ck_password_credentials_hash_present CHECK (length(password_hash) > 0),
  CONSTRAINT ck_password_credentials_revision_positive CHECK (credential_revision > 0),
  CONSTRAINT ck_password_credentials_argon2id_encoding CHECK (left(password_hash, 10) = '$argon2id$')
);

-- Enforce frozen writer invariants even for accidental direct SQL writes.
CREATE FUNCTION identity_foundation_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Identity foundation rows cannot be deleted in MVP' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'auth_identities' THEN
    RAISE EXCEPTION 'Google principal binding is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Identity foundation ownership is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'user_emails' THEN
    IF NEW.user_email_id IS DISTINCT FROM OLD.user_email_id OR NEW.email_revision <> OLD.email_revision + 1 THEN
      RAISE EXCEPTION 'Email change requires stable row and next revision' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.credential_revision <> OLD.credential_revision + 1 OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Credential change requires next revision and preserved creation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_auth_identities_immutable BEFORE UPDATE OR DELETE ON auth_identities
  FOR EACH ROW EXECUTE FUNCTION identity_foundation_write_guard();
CREATE TRIGGER tr_user_emails_revision BEFORE UPDATE OR DELETE ON user_emails
  FOR EACH ROW EXECUTE FUNCTION identity_foundation_write_guard();
CREATE TRIGGER tr_password_credentials_revision BEFORE UPDATE OR DELETE ON password_credentials
  FOR EACH ROW EXECUTE FUNCTION identity_foundation_write_guard();

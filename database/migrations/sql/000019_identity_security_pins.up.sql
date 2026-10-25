-- PIN credentials belong to authenticated Users and are never stored as plaintext.
CREATE TABLE identity_security_pins (
  user_id uuid PRIMARY KEY REFERENCES users (user_id) ON DELETE NO ACTION,
  pin_hash text NOT NULL CHECK (left(pin_hash, 10) = '$argon2id$'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION security_pin_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Security PIN credentials cannot be deleted directly' USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Security PIN changes require stable ownership and incremented revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_identity_security_pins_guard BEFORE UPDATE OR DELETE ON identity_security_pins
  FOR EACH ROW EXECUTE FUNCTION security_pin_write_guard();

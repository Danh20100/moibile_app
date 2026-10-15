-- Rollback is allowed only before identity data has been recorded; populated recovery is forward-only.
DO $$ BEGIN
  LOCK TABLE auth_identities, user_emails, user_profiles, password_credentials IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM auth_identities) OR EXISTS (SELECT 1 FROM user_emails)
    OR EXISTS (SELECT 1 FROM user_profiles) OR EXISTS (SELECT 1 FROM password_credentials) THEN
    RAISE EXCEPTION 'Populated Identity Foundation cannot be rolled back; use reviewed forward recovery';
  END IF;
END $$;
DROP TABLE password_credentials;
DROP TABLE user_profiles;
DROP TABLE user_emails;
DROP TABLE auth_identities;
DROP FUNCTION identity_foundation_write_guard();

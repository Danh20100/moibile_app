DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_profiles WHERE phone_number IS NOT NULL OR residential_address IS NOT NULL) THEN
    RAISE EXCEPTION 'Profile contact data exists; preserve it and roll back application code only.';
  END IF;
END $$;

ALTER TABLE user_profiles
  DROP CONSTRAINT ck_user_profiles_phone,
  DROP CONSTRAINT ck_user_profiles_address,
  DROP COLUMN phone_number,
  DROP COLUMN residential_address;

ALTER TABLE user_profiles
  ADD COLUMN phone_number text,
  ADD COLUMN residential_address text;

ALTER TABLE user_profiles
  ADD CONSTRAINT ck_user_profiles_phone CHECK (phone_number IS NULL OR phone_number ~ '^0[0-9]{9,10}$'),
  ADD CONSTRAINT ck_user_profiles_address CHECK (residential_address IS NULL OR char_length(residential_address) <= 255);

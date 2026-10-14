DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_profile_avatar_intents) OR
     EXISTS (SELECT 1 FROM user_profile_avatars) THEN
    RAISE EXCEPTION 'Migration 000015 contains private avatar data; remove it through the owner-authorized API before rollback.';
  END IF;
END $$;

DROP TABLE user_profile_avatar_intents;
DROP TABLE user_profile_avatars;

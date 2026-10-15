CREATE TABLE user_profile_avatars (
  user_id uuid PRIMARY KEY,
  object_key text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 2097152),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_profile_avatars_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE user_profile_avatar_intents (
  user_id uuid PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('UPLOAD', 'DELETE_PREVIOUS')),
  object_key text NOT NULL UNIQUE,
  previous_object_key text,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 2097152),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_profile_avatar_intents_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT ck_user_profile_avatar_intents_distinct_keys CHECK (
    previous_object_key IS NULL OR previous_object_key <> object_key
  )
);

CREATE INDEX user_profile_avatar_intents_age
  ON user_profile_avatar_intents (created_at, user_id);

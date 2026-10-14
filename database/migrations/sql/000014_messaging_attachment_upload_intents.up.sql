CREATE TABLE messaging_attachment_upload_intents (
  attachment_id uuid PRIMARY KEY,
  message_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  object_key text NOT NULL UNIQUE,
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 4 AND 2000000),
  content_type text NOT NULL CHECK (content_type = 'image/jpeg'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, sender_user_id)
    REFERENCES messaging_participants(conversation_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX messaging_attachment_upload_intents_age
  ON messaging_attachment_upload_intents(created_at, message_id);

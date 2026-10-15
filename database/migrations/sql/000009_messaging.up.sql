CREATE TABLE messaging_conversations (
  conversation_id uuid PRIMARY KEY,
  inquiry_id uuid UNIQUE REFERENCES inquiries(inquiry_id) ON DELETE RESTRICT,
  tenancy_id uuid UNIQUE REFERENCES tenancies(tenancy_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  CHECK (num_nonnulls(inquiry_id, tenancy_id) = 1)
);
CREATE TABLE messaging_participants (
  conversation_id uuid NOT NULL REFERENCES messaging_conversations(conversation_id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX messaging_participants_user ON messaging_participants(user_id, conversation_id);
CREATE TABLE messaging_messages (
  message_id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  text text NOT NULL CHECK (length(text) <= 4000),
  created_at timestamptz NOT NULL,
  FOREIGN KEY (conversation_id, sender_user_id) REFERENCES messaging_participants(conversation_id, user_id) ON DELETE RESTRICT
);
CREATE INDEX messaging_messages_timeline ON messaging_messages(conversation_id, created_at, message_id);
CREATE TABLE messaging_attachments (
  attachment_id uuid PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES messaging_messages(message_id) ON DELETE RESTRICT,
  object_key text NOT NULL UNIQUE,
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 4 AND 2000000),
  content_type text NOT NULL CHECK (content_type = 'image/jpeg')
);
CREATE INDEX messaging_attachments_message ON messaging_attachments(message_id);
CREATE FUNCTION messaging_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Messaging history is immutable' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER messaging_messages_immutable BEFORE UPDATE OR DELETE ON messaging_messages FOR EACH ROW EXECUTE FUNCTION messaging_history_guard();
CREATE TRIGGER messaging_attachments_immutable BEFORE UPDATE OR DELETE ON messaging_attachments FOR EACH ROW EXECUTE FUNCTION messaging_history_guard();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM messaging_attachment_upload_intents) THEN
    RAISE EXCEPTION 'Migration 000014 contains pending Messaging uploads; reconcile them before rollback.';
  END IF;
END $$;

DROP TABLE messaging_attachment_upload_intents;

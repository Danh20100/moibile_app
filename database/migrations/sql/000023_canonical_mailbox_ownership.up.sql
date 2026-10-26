-- Existing aliases must be resolved explicitly before this migration can succeed.
-- Fail closed on duplicates; never delete or silently merge account ownership.
CREATE UNIQUE INDEX uq_user_emails_canonical_mailbox
  ON user_emails (trooi_canonical_email(normalized_email));

DO $$ BEGIN
  RAISE EXCEPTION 'Migration 000010 contains user-entered Listing details; use an explicit data-preserving migration to roll it back.';
END $$;

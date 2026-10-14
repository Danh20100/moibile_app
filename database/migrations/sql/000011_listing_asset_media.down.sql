DO $$ BEGIN
  RAISE EXCEPTION 'Migration 000011 contains user-uploaded private Asset photos; use an explicit data-preserving migration to roll it back.';
END $$;

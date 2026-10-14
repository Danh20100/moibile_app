DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM listing_asset_media_intents) THEN
        RAISE EXCEPTION 'Migration 000013 contains pending Listing media work; reconcile it before rollback.';
    END IF;
END $$;

DROP TABLE listing_asset_media_intents;

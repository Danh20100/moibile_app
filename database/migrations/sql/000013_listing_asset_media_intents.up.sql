CREATE TABLE listing_asset_media_intents (
    media_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    operation text NOT NULL,
    object_key text NOT NULL,
    content_type text NOT NULL,
    byte_size integer NOT NULL,
    position integer NOT NULL,
    content_hash text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_listing_asset_media_intents PRIMARY KEY (media_id),
    CONSTRAINT fk_listing_asset_media_intents_listing FOREIGN KEY (listing_id)
        REFERENCES listings(listing_id) ON DELETE NO ACTION,
    CONSTRAINT ck_listing_asset_media_intents_operation CHECK (operation IN ('UPLOAD', 'DELETE')),
    CONSTRAINT ck_listing_asset_media_intents_hash CHECK (
        (operation = 'UPLOAD' AND content_hash ~ '^[a-f0-9]{64}$') OR
        (operation = 'DELETE' AND content_hash IS NULL)
    ),
    CONSTRAINT ck_listing_asset_media_intents_type CHECK (content_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_listing_asset_media_intents_size CHECK (byte_size BETWEEN 1 AND 5242880),
    CONSTRAINT ck_listing_asset_media_intents_position CHECK (position BETWEEN 0 AND 9)
);

CREATE UNIQUE INDEX uq_listing_asset_media_intents_listing
    ON listing_asset_media_intents(listing_id);

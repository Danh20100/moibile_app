CREATE TABLE listing_asset_media (
    media_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    object_key text NOT NULL,
    content_type text NOT NULL,
    byte_size integer NOT NULL,
    position integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_listing_asset_media PRIMARY KEY (media_id),
    CONSTRAINT fk_listing_asset_media_listing FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE NO ACTION,
    CONSTRAINT uq_listing_asset_media_object_key UNIQUE (object_key),
    CONSTRAINT uq_listing_asset_media_position UNIQUE (listing_id, position) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT ck_listing_asset_media_type CHECK (content_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_listing_asset_media_size CHECK (byte_size BETWEEN 1 AND 5242880),
    CONSTRAINT ck_listing_asset_media_position CHECK (position BETWEEN 0 AND 9)
);
CREATE INDEX ix_listing_asset_media_listing ON listing_asset_media(listing_id, position);

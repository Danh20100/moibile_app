import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('listing_asset_media', {
    public_approved: { type: 'boolean', notNull: true, default: false },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM listing_asset_media WHERE public_approved) THEN
        RAISE EXCEPTION 'Migration 000012 contains owner-approved public photo state; use an explicit data-preserving migration to roll it back.';
      END IF;
    END $$;
  `);
  pgm.dropColumn('listing_asset_media', 'public_approved');
}

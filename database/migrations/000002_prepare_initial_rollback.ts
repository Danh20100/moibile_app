import type {MigrationBuilder} from 'node-pg-migrate' with {'resolution-mode':'import'};
export async function up(pgm:MigrationBuilder):Promise<void>{pgm.sql('-- Preserve immutable initial migration while enabling dependency-safe rollback.');}
export async function down(pgm:MigrationBuilder):Promise<void>{pgm.sql(`ALTER TABLE charges DROP CONSTRAINT IF EXISTS fk_charges_utility_connection; ALTER TABLE charges DROP CONSTRAINT IF EXISTS fk_charges_start_meter_reading; ALTER TABLE charges DROP CONSTRAINT IF EXISTS fk_charges_end_meter_reading; DROP EXTENSION IF EXISTS postgis CASCADE;`);}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decodeImage } from '../../src/modules/listing/services/listing-asset-media.service';
import { rentalAssetMediaFlow } from '../support/rental-fixtures';

test('asset media accepts bounded real JPEG and PNG content and rejects spoofed payloads', () => {
  const jpeg = readFileSync(rentalAssetMediaFlow.images[0]!.path);
  assert.equal(decodeImage({ mediaId: '93000000-0000-4000-8000-000000000001', contentType: 'image/jpeg', base64: jpeg.toString('base64') }).byteLength, jpeg.length);
  const png = readFileSync(rentalAssetMediaFlow.images[1]!.path);
  assert.equal(decodeImage({ mediaId: '93000000-0000-4000-8000-000000000002', contentType: 'image/png', base64: png.toString('base64') }).byteLength, png.length);
  assert.throws(() => decodeImage({ mediaId: '93000000-0000-4000-8000-000000000003', contentType: 'image/png', base64: Buffer.from('not an image').toString('base64') }));
});

test('asset media rollback is data preserving and refuses to drop uploaded references', () => {
  const rollback = readFileSync('database/migrations/sql/000011_listing_asset_media.down.sql', 'utf8');
  assert.match(rollback, /RAISE EXCEPTION/);
  assert.match(rollback, /data-preserving migration/);
  assert.doesNotMatch(rollback, /DROP TABLE/);
});

test('public asset photos are opt-in and rollback refuses approved public state', () => {
  const migration = readFileSync('database/migrations/000012_public_listing_photos.ts', 'utf8');
  assert.match(migration, /public_approved:[\s\S]*default: false/);
  assert.match(migration, /WHERE public_approved/);
  assert.match(migration, /data-preserving migration/);
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createDatabaseClient } from '../../src/infrastructure/database/database.client';
import { loadObjectStorageConfig } from '../../src/infrastructure/object-storage/object-storage.config';
import { createObjectStorageAdapter } from '../../src/infrastructure/object-storage/private-s3-object-storage.adapter';
import { ListingAssetMediaService } from '../../src/modules/listing/services/listing-asset-media.service';
import { rentalFixture } from './persistence/guards/rental-test-support';
import { rentalAssetMediaFlow } from '../support/rental-fixtures';

test('private Listing photos survive PostgreSQL reconnect and MinIO readback', { skip: process.env.LEDGER_MEDIA_MINIO_TEST !== '1' }, async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const f = await rentalFixture(url);
  const mediaId = randomUUID();
  const bytes = readFileSync(rentalAssetMediaFlow.images[0]!.path);
  const storage = createObjectStorageAdapter(loadObjectStorageConfig(process.env));
  let reopened = createDatabaseClient({ url, maxPoolSize: 3, connectionTimeoutMs: 5000 });
  let primaryClosed = false;
  let mediaWritten = false;
  try {
    const first = new ListingAssetMediaService(f.db, storage);
    const saved = await first.upload(f.ids.listing, { mediaId, contentType: rentalAssetMediaFlow.images[0]!.contentType, base64: bytes.toString('base64') });
    mediaWritten = true;
    assert.equal(saved.position, 0);
    await f.db.destroy();
    primaryClosed = true;
    const reloaded = new ListingAssetMediaService(reopened, storage);
    assert.deepEqual((await reloaded.list(f.ids.listing)).map((item) => item.id), [mediaId]);
    const content = await reloaded.content(f.ids.listing, mediaId);
    assert.equal(content.contentType, 'image/jpeg');
    assert.deepEqual(Buffer.from(content.base64, 'base64'), bytes);
    await reloaded.remove(f.ids.listing, mediaId);
    assert.deepEqual(await reloaded.list(f.ids.listing), []);
  } finally {
    if (mediaWritten) await new ListingAssetMediaService(reopened, storage).remove(f.ids.listing, mediaId).catch(() => undefined);
    await reopened.destroy();
    if (!primaryClosed) await f.db.destroy();
  }
});

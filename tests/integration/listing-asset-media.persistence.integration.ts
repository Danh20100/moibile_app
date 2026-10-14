import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ListingAssetMediaService } from '../../src/modules/listing/services/listing-asset-media.service';
import { rentalFixture } from './persistence/guards/rental-test-support';
import { rentalAssetMediaFlow } from '../support/rental-fixtures';

test('asset photo bytes and ordering persist in PostgreSQL and retries cannot change media content', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const f = await rentalFixture(url);
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  let failDelete = false;
  let failRestore = false;
  const storage = {
    async putObject(value: { key: string; bytes: Uint8Array; contentType: string }) { if (failRestore) throw new Error('storage restore unavailable'); objects.set(value.key, value); },
    async getObject(key: string) { return objects.get(key) ?? null; },
    async deleteObject(key: string) { if (failDelete) throw new Error('storage unavailable'); objects.delete(key); },
  };
  const service = new ListingAssetMediaService(f.db, storage);
  const firstBytes = readFileSync(rentalAssetMediaFlow.images[0]!.path);
  const secondBytes = readFileSync(rentalAssetMediaFlow.images[2]!.path);
  const listingId = f.ids.listing, first = randomUUID(), second = randomUUID();
  try {
    const add = (mediaId: string, bytes: Buffer) => service.upload(listingId, { mediaId, contentType: rentalAssetMediaFlow.images[0]!.contentType, base64: bytes.toString('base64') });
    assert.equal((await add(first, firstBytes)).position, 0);
    assert.deepEqual(await Promise.all([add(first, firstBytes), add(first, firstBytes)]).then((items) => items.map((item) => item.id)), [first, first]);
    await assert.rejects(add(first, secondBytes));
    await add(second, secondBytes);
    assert.deepEqual((await service.list(listingId)).map((item) => item.id), [first, second]);
    const reopened = new ListingAssetMediaService(f.db, storage);
    assert.deepEqual(await reopened.reorder(listingId, { mediaIds: [second, first] }).then((rows) => rows.map((row) => row.id)), [second, first]);
    const image = await reopened.content(listingId, second);
    assert.equal(image.contentType, rentalAssetMediaFlow.images[0]!.contentType);
    assert.deepEqual(Buffer.from(image.base64, 'base64'), secondBytes);
    const failedTransactionDb = {
      selectFrom: f.db.selectFrom.bind(f.db),
      transaction: () => ({ execute: async () => { throw new Error('database unavailable'); } }),
    } as unknown as typeof f.db;
    await assert.rejects(new ListingAssetMediaService(failedTransactionDb, storage).remove(listingId, second));
    assert.deepEqual(Buffer.from((await reopened.content(listingId, second)).base64, 'base64'), secondBytes);
    failRestore = true;
    await assert.rejects(new ListingAssetMediaService(failedTransactionDb, storage).remove(listingId, second), { message: 'Asset photo removal needs reconciliation' });
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [second, first]);
    failRestore = false;
    await storage.putObject({ key: `rental-assets/${listingId}/${second}.jpg`, bytes: secondBytes, contentType: 'image/jpeg' });
    failDelete = true;
    await assert.rejects(reopened.remove(listingId, second));
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [second, first]);
    failDelete = false;
    await reopened.remove(listingId, second);
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [first]);
  } finally { await f.db.destroy(); }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ListingAssetMediaService } from '../../src/modules/listing/services/listing-asset-media.service';
import { rentalFixture } from './persistence/guards/rental-test-support';
import { rentalAssetMediaFlow } from '../support/rental-fixtures';

function failTransactionAfterWork(db: any, transactionToFail: number): any {
  let transactionCount = 0;
  return {
    ...db,
    transaction: () => {
      transactionCount++;
      const failAfterWork = transactionCount === transactionToFail;
      return {
        execute: (callback: (tx: any) => Promise<unknown>) => db.transaction().execute(async (tx: any) => {
          const value = await callback(tx);
          if (failAfterWork) throw new Error('database commit unavailable');
          return value;
        }),
      };
    },
  };
}

test('asset photo bytes and ordering persist in PostgreSQL and retries cannot change media content', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const f = await rentalFixture(url);
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  let failDelete = false;
  const storage = {
    async putObject(value: { key: string; bytes: Uint8Array; contentType: string }) { objects.set(value.key, value); },
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
    const interruptedUploadId = randomUUID();
    const interruptedUpload = { mediaId: interruptedUploadId, contentType: 'image/jpeg' as const, base64: firstBytes.toString('base64') };
    const uploadKey = `rental-assets/${listingId}/${interruptedUploadId}.jpg`;
    await assert.rejects(new ListingAssetMediaService(failTransactionAfterWork(f.db, 2), storage).upload(listingId, interruptedUpload), { message: 'Asset photo upload pending reconciliation' });
    assert.equal(objects.has(uploadKey), true);
    const pendingUpload = await f.db.selectFrom('listing_asset_media_intents').selectAll().where('media_id', '=', interruptedUploadId).executeTakeFirst();
    assert.equal(pendingUpload?.operation, 'UPLOAD');
    assert.equal(await reopened.reconcilePendingIntents(), 1);
    assert.equal(objects.has(uploadKey), false);
    assert.equal(await f.db.selectFrom('listing_asset_media_intents').selectAll().where('media_id', '=', interruptedUploadId).executeTakeFirst().then(Boolean), false);

    const failFinalizeDb = failTransactionAfterWork(f.db, 2) as typeof f.db;
    await assert.rejects(new ListingAssetMediaService(failFinalizeDb, storage).remove(listingId, second), { message: 'Asset photo removal pending reconciliation' });
    assert.equal(objects.has(`rental-assets/${listingId}/${second}.jpg`), false);
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [second, first]);
    assert.equal(await f.db.selectFrom('listing_asset_media_intents').selectAll().where('media_id', '=', second).executeTakeFirst().then(Boolean), true);
    assert.equal(await reopened.reconcilePendingIntents(), 1);
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [first]);
    failDelete = true;
    await assert.rejects(reopened.remove(listingId, first), { message: 'Asset photo removal pending reconciliation' });
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [first]);
    failDelete = false;
    await reopened.remove(listingId, first);
    assert.deepEqual(await reopened.list(listingId), []);
  } finally { await f.db.destroy(); }
});

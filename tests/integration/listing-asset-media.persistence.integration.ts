import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { ListingAssetMediaService } from '../../src/modules/listing/services/listing-asset-media.service';
import { PrivateS3ObjectStorageAdapter } from '../../src/infrastructure/object-storage/private-s3-object-storage.adapter';
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
  const endpoint = process.env.LEDGER_J04_S3_ENDPOINT;
  const accessKey = process.env.LEDGER_J04_S3_ACCESS_KEY;
  const secretKey = process.env.LEDGER_J04_S3_SECRET_KEY;
  assert.ok(endpoint && accessKey && secretKey, 'LEDGER_J04_S3_* local MinIO settings are required');
  assert.equal(new URL(endpoint).hostname, '127.0.0.1', 'fault injection must use local MinIO');
  const bucket = `trooi-media-fault-${randomUUID()}`;
  const s3 = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  const realStorage = new PrivateS3ObjectStorageAdapter({
    enabled: true,
    endpoint,
    region: 'us-east-1',
    bucket,
    accessKey,
    secretKey,
    forcePathStyle: true,
  });
  let destroyDb: (() => Promise<void>) | undefined;
  let failDelete = false;
  const storage = {
    putObject: (value: { key: string; bytes: Uint8Array; contentType: string }) => realStorage.putObject(value),
    getObject: (key: string) => realStorage.getObject(key),
    async deleteObject(key: string) {
      if (failDelete) throw new Error('storage unavailable');
      await realStorage.deleteObject(key);
    },
  };
  try {
    const f = await rentalFixture(url);
    destroyDb = () => f.db.destroy();
    const service = new ListingAssetMediaService(f.db, storage);
    const firstBytes = readFileSync(rentalAssetMediaFlow.images[0]!.path);
    const secondBytes = readFileSync(rentalAssetMediaFlow.images[2]!.path);
    const listingId = f.ids.listing, first = randomUUID(), second = randomUUID();
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
    assert.deepEqual(Buffer.from((await realStorage.getObject(uploadKey))!.bytes), firstBytes);
    const pendingUpload = await f.db.selectFrom('listing_asset_media_intents').selectAll().where('media_id', '=', interruptedUploadId).executeTakeFirst();
    assert.equal(pendingUpload?.operation, 'UPLOAD');
    const afterUploadRestart = new ListingAssetMediaService(f.db, storage);
    await afterUploadRestart.onModuleInit();
    assert.equal(await realStorage.getObject(uploadKey), null);
    assert.equal(await f.db.selectFrom('listing_asset_media_intents').selectAll().where('media_id', '=', interruptedUploadId).executeTakeFirst().then(Boolean), false);

    const failFinalizeDb = failTransactionAfterWork(f.db, 2) as typeof f.db;
    await assert.rejects(new ListingAssetMediaService(failFinalizeDb, storage).remove(listingId, second), { message: 'Asset photo removal pending reconciliation' });
    assert.equal(await realStorage.getObject(`rental-assets/${listingId}/${second}.jpg`), null);
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [second, first]);
    assert.equal(await f.db.selectFrom('listing_asset_media_intents').selectAll().where('media_id', '=', second).executeTakeFirst().then(Boolean), true);
    const afterDeleteRestart = new ListingAssetMediaService(f.db, storage);
    await afterDeleteRestart.onModuleInit();
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [first]);
    failDelete = true;
    await assert.rejects(reopened.remove(listingId, first), { message: 'Asset photo removal pending reconciliation' });
    assert.deepEqual((await reopened.list(listingId)).map((item) => item.id), [first]);
    assert.ok(await realStorage.getObject(`rental-assets/${listingId}/${first}.jpg`));
    failDelete = false;
    await reopened.remove(listingId, first);
    assert.deepEqual(await reopened.list(listingId), []);
  } finally {
    await destroyDb?.();
    let continuationToken: string | undefined;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
      for (const object of page.Contents ?? [])
        if (object.Key) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);
    await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
    s3.destroy();
  }
});

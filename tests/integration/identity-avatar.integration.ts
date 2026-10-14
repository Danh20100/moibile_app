import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, ListObjectsV2Command, S3Client,
} from '@aws-sdk/client-s3';
import { IdentityAccessController } from '../../src/modules/identity-access/controllers/identity-access.controller';
import { IdentityAccessService } from '../../src/modules/identity-access/services/identity-access.service';
import { ProfileAvatarService } from '../../src/modules/identity-access/services/profile-avatar.service';
import { PrivateS3ObjectStorageAdapter } from '../../src/infrastructure/object-storage/private-s3-object-storage.adapter';
import { PostgresIdentityRepository } from '../../src/infrastructure/database/repositories/identity.repository';
import { createDatabaseClient } from '../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../src/infrastructure/database/repositories/repository-set';
import { rentalFixture } from './persistence/guards/rental-test-support';
import { rentalAssetMediaFlow } from '../support/rental-fixtures';
import { loadGooglePrincipals } from '../support/identity-fixtures';

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

test('private profile avatar is User-scoped, survives replacement, and reconciles interrupted writes', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
  const accessKey = process.env.OBJECT_STORAGE_ACCESS_KEY;
  const secretKey = process.env.OBJECT_STORAGE_SECRET_KEY;
  assert.ok(endpoint && accessKey && secretKey, 'OBJECT_STORAGE_* local MinIO settings are required');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(endpoint).hostname), 'integration must use local MinIO');

  const bucket = `trooi-avatar-${randomUUID()}`;
  const s3 = new S3Client({ endpoint, region: 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } });
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  const realStorage = new PrivateS3ObjectStorageAdapter({ enabled: true, endpoint, region: 'us-east-1', bucket,
    accessKey, secretKey, forcePathStyle: true });
  let failDelete = false;
  let destroyDb: (() => Promise<void>) | undefined;
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
    const outsiderId = loadGooglePrincipals().userSecond;
    await new PostgresIdentityRepository(f.db).ensureUser(outsiderId);
    const owner: Parameters<IdentityAccessController['getOwnAvatar']>[0] = {
      userId: f.ids.user, provider: 'google', issuer: 'https://accounts.google.com', subject: 'avatar-owner',
    };
    const outsider = { ...owner, userId: outsiderId, subject: 'avatar-outsider' };
    const service = new ProfileAvatarService(f.db, storage);
    await assert.rejects(() => service.content(outsiderId), (error: unknown) =>
      typeof error === 'object' && error !== null && 'getStatus' in error &&
        typeof error.getStatus === 'function' && error.getStatus() === 404);
    const controller = new IdentityAccessController(new IdentityAccessService(f.manager), service);
    await assert.rejects(() => controller.getOwnAvatar(undefined), { status: 401 });

    const first = readFileSync(rentalAssetMediaFlow.images[0]!.path);
    const second = readFileSync(rentalAssetMediaFlow.images[2]!.path);
    const upload = (bytes: Buffer, contentType: 'image/jpeg' | 'image/png') =>
      controller.uploadOwnAvatar(owner, { contentType, base64: bytes.toString('base64') });
    const firstMetadata = await upload(first, rentalAssetMediaFlow.images[0]!.contentType);
    assert.equal(firstMetadata.byteSize, first.length);
    assert.deepEqual(Object.keys(firstMetadata).sort(), ['byteSize', 'contentType', 'updatedAt']);
    assert.deepEqual(Buffer.from((await controller.getOwnAvatar(owner)).base64, 'base64'), first);
    const firstRow = await f.db.selectFrom('user_profile_avatars').selectAll().where('user_id', '=', f.ids.user).executeTakeFirstOrThrow();
    assert.ok(firstRow.object_key.startsWith(`user-avatars/${f.ids.user}/`));
    assert.equal(await realStorage.getObject(firstRow.object_key).then(Boolean), true);
    await assert.rejects(() => controller.getOwnAvatar(outsider), (error: unknown) =>
      typeof error === 'object' && error !== null && 'getStatus' in error &&
        typeof error.getStatus === 'function' && error.getStatus() === 404);

    failDelete = true;
    const secondMetadata = await upload(second, rentalAssetMediaFlow.images[2]!.contentType);
    assert.equal(secondMetadata.byteSize, second.length);
    assert.deepEqual(Buffer.from((await controller.getOwnAvatar(owner)).base64, 'base64'), second);
    const pendingCleanup = await f.db.selectFrom('user_profile_avatar_intents').selectAll().where('user_id', '=', f.ids.user).executeTakeFirstOrThrow();
    assert.equal(pendingCleanup.operation, 'DELETE_PREVIOUS');
    assert.equal(pendingCleanup.previous_object_key, firstRow.object_key);
    failDelete = false;
    await new ProfileAvatarService(f.db, storage).onModuleInit();
    assert.equal(await realStorage.getObject(firstRow.object_key), null);
    assert.equal(await f.db.selectFrom('user_profile_avatar_intents').selectAll().where('user_id', '=', f.ids.user).executeTakeFirst().then(Boolean), false);
    await f.db.destroy();
    const reconnectedDb = createDatabaseClient({ url, maxPoolSize: 4, connectionTimeoutMs: 5000 });
    destroyDb = () => reconnectedDb.destroy();
    const reopenedService = new ProfileAvatarService(reconnectedDb, storage);
    await reopenedService.onModuleInit();
    const reopenedController = new IdentityAccessController(
      new IdentityAccessService(new PostgresTransactionManager(reconnectedDb, createRepositorySet)), reopenedService,
    );
    assert.deepEqual(Buffer.from((await reopenedController.getOwnAvatar(owner)).base64, 'base64'), second);

    const failingService = new ProfileAvatarService(failTransactionAfterWork(reconnectedDb, 2), storage);
    await assert.rejects(() => failingService.upload(f.ids.user, {
      contentType: rentalAssetMediaFlow.images[0]!.contentType, base64: first.toString('base64'),
    }), (error: unknown) => typeof error === 'object' && error !== null && 'getStatus' in error &&
      typeof error.getStatus === 'function' && error.getStatus() === 503);
    const interrupted = await reconnectedDb.selectFrom('user_profile_avatar_intents').selectAll().where('user_id', '=', f.ids.user).executeTakeFirstOrThrow();
    assert.equal(interrupted.operation, 'UPLOAD');
    assert.ok(await realStorage.getObject(interrupted.object_key));
    await new ProfileAvatarService(reconnectedDb, storage).onModuleInit();
    assert.equal(await realStorage.getObject(interrupted.object_key), null);
    assert.deepEqual(Buffer.from((await reopenedController.getOwnAvatar(owner)).base64, 'base64'), second);
    assert.equal(await reconnectedDb.selectFrom('user_profile_avatar_intents').selectAll().where('user_id', '=', f.ids.user).executeTakeFirst().then(Boolean), false);
  } finally {
    await destroyDb?.();
    let continuationToken: string | undefined;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
      for (const object of page.Contents ?? []) if (object.Key) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);
    await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
    s3.destroy();
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import {
  createObjectStorageAdapter,
  PrivateObjectStorageError,
  PrivateS3ObjectStorageAdapter,
} from '../../../src/infrastructure/object-storage/private-s3-object-storage.adapter';
import { ObjectStorageUnavailableError } from '../../../src/infrastructure/object-storage/unavailable-object-storage.adapter';
import { verificationFixture } from '../../support/verification-fixtures';

const F = verificationFixture.storage;
const bytes = Uint8Array.from(F.bytes);

test('disabled S3 config keeps intentional fail-closed behavior', async () => {
  const storage = createObjectStorageAdapter(F.disabled);
  await assert.rejects(
    storage.putObject({ key: F.keys.disabled, bytes, contentType: F.mime }),
    ObjectStorageUnavailableError,
  );
  await assert.rejects(storage.getObject(F.keys.disabled), ObjectStorageUnavailableError);
});

test('private object adapter writes bytes with no public ACL and uses explicit private bucket', async () => {
  const sent: unknown[] = [];
  const fake = {
    send: async (cmd: unknown) => {
      sent.push(cmd);
      return {};
    },
  } as S3Client;
  const adapter = new PrivateS3ObjectStorageAdapter(F.config, fake);
  await adapter.putObject({ key: F.keys.put, bytes, contentType: F.mime });
  assert.equal(sent.length, 1);
  assert.ok(sent[0] instanceof PutObjectCommand);
  assert.deepEqual((sent[0] as PutObjectCommand).input, {
    Bucket: F.config.bucket,
    Key: F.keys.put,
    Body: bytes,
    ContentType: F.mime,
  });
  assert.equal(Object.hasOwn((sent[0] as PutObjectCommand).input, 'ACL'), false);
});

test('private adapter retrieves bytes, treats missing objects as null and sanitizes S3 failures', async () => {
  const fake = {
    send: async () => ({ Body: { transformToByteArray: async () => bytes }, ContentType: F.mime }),
  } as unknown as S3Client;
  assert.deepEqual(await new PrivateS3ObjectStorageAdapter(F.config, fake).getObject(F.keys.get), {
    bytes,
    contentType: F.mime,
  });
  const missing = {
    send: async () => {
      throw F.missing;
    },
  } as unknown as S3Client;
  assert.equal(
    await new PrivateS3ObjectStorageAdapter(F.config, missing).getObject(F.keys.get),
    null,
  );
  const failed = {
    send: async () => {
      throw new Error(F.error);
    },
  } as unknown as S3Client;
  await assert.rejects(
    new PrivateS3ObjectStorageAdapter(F.config, failed).getObject(F.keys.get),
    (error: unknown) => {
      assert.ok(error instanceof PrivateObjectStorageError);
      assert.doesNotMatch(error.message, /secret|private-id|local-private/);
      return true;
    },
  );
});

test('invalid S3 keys, empty payload, or newline MIME fail before the network', async () => {
  let requests = 0;
  const fake = {
    send: async () => {
      requests += 1;
      return {};
    },
  } as unknown as S3Client;
  const store = new PrivateS3ObjectStorageAdapter(F.config, fake);
  for (const key of F.invalidKeys) {
    await assert.rejects(
      store.putObject({ key, bytes, contentType: F.mime }),
      PrivateObjectStorageError,
    );
    await assert.rejects(store.getObject(key), PrivateObjectStorageError);
  }
  await assert.rejects(
    store.putObject({
      key: F.keys.invalidPayload,
      bytes: Uint8Array.from(F.emptyBytes),
      contentType: F.mime,
    }),
    PrivateObjectStorageError,
  );
  await assert.rejects(
    store.putObject({ key: F.keys.invalidPayload, bytes, contentType: F.badMime }),
    PrivateObjectStorageError,
  );
  assert.equal(requests, 0);
});

test('private S3 rejects remote HTTP and invalid endpoints before SDK creation or injected-client dispatch', () => {
  let requests = 0;
  const injected = {
    send: async () => {
      requests += 1;
      return {};
    },
  } as unknown as S3Client;
  for (const endpoint of F.invalidEndpoints) {
    const config = { ...F.config, endpoint };
    assert.throws(() => new PrivateS3ObjectStorageAdapter(config), PrivateObjectStorageError);
    assert.throws(
      () => new PrivateS3ObjectStorageAdapter(config, injected),
      PrivateObjectStorageError,
    );
  }
  assert.equal(requests, 0);
  for (const endpoint of F.validEndpoints) {
    assert.doesNotThrow(
      () => new PrivateS3ObjectStorageAdapter({ ...F.config, endpoint }, injected),
    );
  }
});

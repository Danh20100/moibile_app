import assert from 'node:assert/strict';
import test from 'node:test';

import { NoopCacheAdapter } from '../../../src/infrastructure/cache/noop-cache.adapter';
import {
  ObjectStorageUnavailableError,
  UnavailableObjectStorageAdapter,
} from '../../../src/infrastructure/object-storage/unavailable-object-storage.adapter';

test('disabled cache always misses and accepts ephemeral operations without persistence', async () => {
  const cache = new NoopCacheAdapter();
  await cache.setJson('organization:summary:1', { total: 2 }, 30);
  assert.equal(await cache.getJson('organization:summary:1'), null);
  await cache.delete('organization:summary:1');
  assert.equal(await cache.getJson('organization:summary:1'), null);
});

test('unwired object storage cannot falsely acknowledge an upload or download', async () => {
  const storage = new UnavailableObjectStorageAdapter();
  await assert.rejects(
    storage.putObject({ key: 'incidents/example', bytes: new Uint8Array([1]), contentType: 'image/png' }),
    ObjectStorageUnavailableError,
  );
  await assert.rejects(storage.getObject('incidents/example'), ObjectStorageUnavailableError);
});

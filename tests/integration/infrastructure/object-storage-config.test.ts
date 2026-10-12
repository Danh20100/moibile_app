import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadObjectStorageConfig,
  ObjectStorageConfigurationError,
} from '../../../src/infrastructure/object-storage/object-storage.config';

const valid = {
  OBJECT_STORAGE_ENABLED: 'true',
  OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
  OBJECT_STORAGE_REGION: 'us-east-1',
  OBJECT_STORAGE_BUCKET: 'trooi-media',
  OBJECT_STORAGE_ACCESS_KEY: 'local-access',
  OBJECT_STORAGE_SECRET_KEY: 'local-secret',
};

test('object storage defaults to disabled and never supplies fake credentials', () => {
  assert.deepEqual(loadObjectStorageConfig({}), { enabled: false });
  assert.deepEqual(loadObjectStorageConfig({ OBJECT_STORAGE_ENABLED: 'false' }), { enabled: false });
});

test('object storage requires explicit credentials and private bucket configuration', () => {
  assert.deepEqual(loadObjectStorageConfig(valid), {
    enabled: true,
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    bucket: 'trooi-media',
    accessKey: 'local-access',
    secretKey: 'local-secret',
    forcePathStyle: true,
  });
  assert.equal(loadObjectStorageConfig({
    ...valid, OBJECT_STORAGE_FORCE_PATH_STYLE: 'false',
  }).enabled, true);

  for (const key of Object.keys(valid).filter((name) => name !== 'OBJECT_STORAGE_ENABLED')) {
    assert.throws(
      () => loadObjectStorageConfig({ ...valid, [key]: '' }),
      ObjectStorageConfigurationError,
      key,
    );
  }
  for (const endpoint of [
    'ftp://localhost:9000',
    'http://user:password@localhost:9000',
    'http://localhost:9000/private',
    'http://localhost:9000/?token=secret',
  ]) {
    assert.throws(() => loadObjectStorageConfig({
      ...valid, OBJECT_STORAGE_ENDPOINT: endpoint,
    }), ObjectStorageConfigurationError);
  }
  for (const bucket of ['ABCD', '.hidden', 'x', 'invalid_bucket', 'a..b']) {
    assert.throws(() => loadObjectStorageConfig({
      ...valid, OBJECT_STORAGE_BUCKET: bucket,
    }), ObjectStorageConfigurationError);
  }
  assert.throws(() => loadObjectStorageConfig({
    ...valid, OBJECT_STORAGE_FORCE_PATH_STYLE: 'yes',
  }), ObjectStorageConfigurationError);
});

test('partial enable is rejected instead of silently activating storage', () => {
  for (const value of ['TRUE', '1', 'maybe']) {
    assert.throws(
      () => loadObjectStorageConfig({ OBJECT_STORAGE_ENABLED: value }),
      ObjectStorageConfigurationError,
    );
  }
});

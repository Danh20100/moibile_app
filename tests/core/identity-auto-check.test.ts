import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { autoCheckState, decodeKycJpeg, faceMatchThreshold } from '../../src/modules/identity-verification/auto-identity-check.service';
import { loadCompreFaceConfig } from '../../src/integrations/compreface/compreface-verifier';

test('auto face check needs actual bounded matching evidence; never blindly approves', () => {
  assert.equal(autoCheckState(0.89999), 'NEEDS_RETRY');
  assert.equal(autoCheckState(0.90), 'AUTO_CHECK_PASSED');
  assert.equal(autoCheckState(1), 'AUTO_CHECK_PASSED');
  for (const value of [NaN, -1, Infinity, 1.01]) {
    assert.throws(() => autoCheckState(value), BadRequestException);
  }
});

test('local Compose MVP allows 0.38 but production remains 0.90', () => {
  const local = {
    TROOI_LOCAL_KYC_FACE_THRESHOLD: '0.38',
    TROOI_DATABASE_MODE: 'compose-postgres',
    TROOI_LOCAL_COMPREFACE_LAB: 'true',
    COMPREFACE_ENABLED: 'true',
    COMPREFACE_ORIGIN: 'http://compreface-fe',
  };
  assert.equal(faceMatchThreshold(local), 0.38);
  assert.equal(autoCheckState(0.39588, local), 'AUTO_CHECK_PASSED');
  assert.equal(autoCheckState(0.37999, local), 'NEEDS_RETRY');
  assert.equal(autoCheckState(0.39588), 'NEEDS_RETRY');
  for (const invalid of [
    { ...local, TROOI_DATABASE_MODE: 'external-finance' },
    { ...local, TROOI_LOCAL_COMPREFACE_LAB: 'false' },
    { ...local, COMPREFACE_ORIGIN: 'https://face.example.com' },
    { ...local, TROOI_LOCAL_KYC_FACE_THRESHOLD: '0.20' },
    { ...local, TROOI_LOCAL_KYC_FACE_THRESHOLD: 'n/a' },
  ]) {
    assert.throws(() => faceMatchThreshold(invalid));
  }
});

test('KYC image preflight rejects empty, oversized and malformed JPEGs', () => {
  for (const input of [null, undefined, '', 'AA==', 'AAAA', 'not base64!!!', 'x'.repeat(2_000_100)]) {
    assert.throws(() => decodeKycJpeg(input), BadRequestException);
  }
  const invalid = Buffer.alloc(200, 0xff);
  invalid[0] = 0x00;
  assert.throws(() => decodeKycJpeg(invalid.toString('base64')), BadRequestException);
  const envelope = Buffer.alloc(100, 0);
  envelope[0] = 0xff; envelope[1] = 0xd8; envelope[98] = 0xff; envelope[99] = 0xd9;
  assert.equal(decodeKycJpeg(envelope.toString('base64')).byteLength, 100);
});

test('plain HTTP is accepted only for the isolated Compose verification lab', () => {
  const env = {
    COMPREFACE_ENABLED: 'true',
    COMPREFACE_API_KEY: 'fixture-key',
    COMPREFACE_ORIGIN: 'http://compreface-fe',
    TROOI_LOCAL_COMPREFACE_LAB: 'true',
    TROOI_DATABASE_MODE: 'compose-postgres',
  };
  assert.equal(loadCompreFaceConfig(env).enabled, true);
  assert.throws(() => loadCompreFaceConfig({ ...env, TROOI_LOCAL_COMPREFACE_LAB: 'false' }));
  assert.throws(() => loadCompreFaceConfig({ ...env, TROOI_DATABASE_MODE: 'finance-production' }));
  assert.throws(() => loadCompreFaceConfig({ ...env, COMPREFACE_ORIGIN: 'http://external-host' }));
});

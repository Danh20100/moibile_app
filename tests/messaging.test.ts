import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeMessageImages } from '../src/modules/messaging/messaging.service';

test('messaging accepts text or bounded JPEG bytes', () => {
  assert.deepEqual(decodeMessageImages({ text: 'Hello' }), []);
  const bytes = Buffer.from([255, 216, 255, 224, 255, 217]);
  assert.deepEqual(
    decodeMessageImages({
      images: [{ contentType: 'image/jpeg', base64: bytes.toString('base64') }],
    }),
    [bytes],
  );
});
test('maximum allowed image decodes without regex stack overflow', () => {
  const bytes = Buffer.alloc(2_000_000);
  bytes.set([255, 216, 255]);
  bytes.set([255, 217], bytes.length - 2);
  assert.equal(
    decodeMessageImages({
      images: [{ contentType: 'image/jpeg', base64: bytes.toString('base64') }],
    })[0].length,
    2_000_000,
  );
});
test('messaging rejects empty, spoofed, oversized and malformed payloads', () => {
  for (const dto of [
    {},
    { text: ' ' },
    { text: 'a'.repeat(4001) },
    { images: [{ contentType: 'image/jpeg' as const, base64: 'YWJjZA==' }] },
    { images: [{ contentType: 'image/jpeg' as const, base64: '////!==' }] },
    { images: Array(6).fill({ contentType: 'image/jpeg', base64: '/9j/4P/Z' }) },
  ]) {
    assert.throws(() => decodeMessageImages(dto));
  }
});

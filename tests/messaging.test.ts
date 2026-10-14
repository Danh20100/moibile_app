import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { encode } from 'jpeg-js';
import { decodeMessageImages } from '../src/modules/messaging/messaging.service';

test('messaging accepts text or bounded JPEG bytes', () => {
  assert.deepEqual(decodeMessageImages({ text: 'Hello' }), []);
  const bytes = encode({width: 1, height: 1, data: Buffer.from([255, 0, 0, 255])}, 80).data;
  assert.deepEqual(
    decodeMessageImages({
      images: [{ contentType: 'image/jpeg', base64: bytes.toString('base64') }],
    }),
    [bytes],
  );
});
test('maximum-sized invalid image fails without regex stack overflow', () => {
  const bytes = Buffer.alloc(2_000_000);
  bytes.set([255, 216, 255]);
  bytes.set([255, 217], bytes.length - 2);
  assert.throws(() => decodeMessageImages({
    images: [{ contentType: 'image/jpeg', base64: bytes.toString('base64') }],
  }));
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

test('signature-only payload is not JPEG content', () => {
  assert.throws(() => decodeMessageImages({images: [{contentType: 'image/jpeg', base64: '/9j/4P/Z'}]}));
});

test('valid JPEG at the exact two-million-byte boundary is accepted', () => {
  const jpeg = encode({ width: 1, height: 1, data: Buffer.from([255, 0, 0, 255]) }, 80).data;
  const chunks = [jpeg.subarray(0, -2)];
  let remaining = 2_000_000 - jpeg.length;
  while (remaining) {
    let size = Math.min(remaining, 65537);
    if (remaining - size > 0 && remaining - size < 4) size -= 4;
    chunks.push(Buffer.from([255, 254, (size - 2) >> 8, (size - 2) & 255]), Buffer.alloc(size - 4));
    remaining -= size;
  }
  chunks.push(jpeg.subarray(-2));
  const bytes = Buffer.concat(chunks);
  assert.equal(decodeMessageImages({ images: [{ contentType: 'image/jpeg', base64: bytes.toString('base64') }] })[0].length, 2_000_000);
  assert.throws(() => decodeMessageImages({ images: [{ contentType: 'image/jpeg', base64: Buffer.concat([bytes, Buffer.from([0])]).toString('base64') }] }));
});

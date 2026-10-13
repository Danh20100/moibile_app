import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CompreFaceVerifier,
  FaceComparisonUnavailableError,
  FaceComparisonInvalidResponseError,
  loadCompreFaceConfig,
  CompreFaceConfigurationError,
} from '../../../src/integrations/compreface/compreface-verifier';
import { verificationFixture } from '../../support/verification-fixtures';

const F = verificationFixture.face;
const jpeg = Uint8Array.from(F.jpeg);

test('CompreFace is opt-in and refuses missing key, remote HTTP without TLS and bad timeouts', () => {
  assert.deepEqual(loadCompreFaceConfig({}), F.disabled);
  for (const env of [
    F.configCases.remoteHttp,
    F.configCases.timeoutZero,
    F.configCases.missingKey,
  ]) {
    assert.throws(() => loadCompreFaceConfig(env), CompreFaceConfigurationError);
  }
  assert.deepEqual(loadCompreFaceConfig(F.configCases.valid), F.loaded);
});

test('CompreFace includes the only API key in an injected transport; result is evidence, not VERIFIED', async () => {
  let requests = 0;
  const transport: typeof fetch = async (input, init) => {
    assert.equal(input, F.enabled.origin + '/api/v1/verification/verify');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Record<string, string>)['x-api-key'], F.enabled.apiKey);
    assert.ok(init?.signal);
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.body instanceof FormData);
    const data = init.body as FormData;
    assert.ok(data.get('source_image') instanceof Blob);
    assert.ok(data.get('target_image') instanceof Blob);
    requests += 1;
    return Response.json(F.success);
  };
  const result = await new CompreFaceVerifier(F.enabled, transport).compare(jpeg, jpeg);
  assert.equal(requests, 1);
  assert.deepEqual(result, F.expected);
  assert.equal(Object.hasOwn(result, 'verified'), false);
});

test('CompreFace disabled/unavailable fails closed and never leaks upstream error', async () => {
  await assert.rejects(
    new CompreFaceVerifier(F.disabled).compare(jpeg, jpeg),
    FaceComparisonUnavailableError,
  );
  const api: typeof fetch = async () => {
    throw new Error(F.upstreamError);
  };
  await assert.rejects(
    new CompreFaceVerifier(F.enabled, api).compare(jpeg, jpeg),
    (error: unknown) => {
      assert.ok(error instanceof FaceComparisonUnavailableError);
      assert.doesNotMatch(error.message, /secret|jpeg|token/);
      return true;
    },
  );
  const noKey: typeof fetch = async () => new Response(F.httpError, { status: F.httpErrorStatus });
  await assert.rejects(
    new CompreFaceVerifier(F.enabled, noKey).compare(jpeg, jpeg),
    FaceComparisonUnavailableError,
  );
});

test('CompreFace refuses malformed JPEG envelopes before network dispatch', async () => {
  let requests = 0;
  const transport: typeof fetch = async () => {
    requests += 1;
    throw new Error(F.invalidInputError);
  };
  const verifier = new CompreFaceVerifier(F.enabled, transport);
  for (const bytes of F.invalidJpegs) {
    const bad = Uint8Array.from(bytes);
    await assert.rejects(verifier.compare(bad, jpeg), FaceComparisonInvalidResponseError);
    await assert.rejects(verifier.compare(jpeg, bad), FaceComparisonInvalidResponseError);
  }
  assert.equal(requests, 0);
});

test('CompreFace rejects missing faces, multiple faces, out of range and invalid JSON', async () => {
  for (const data of Object.values(F.invalidResponses)) {
    const transport: typeof fetch = async () => Response.json(data);
    await assert.rejects(
      new CompreFaceVerifier(F.enabled, transport).compare(jpeg, jpeg),
      FaceComparisonInvalidResponseError,
    );
  }
  const invalid: typeof fetch = async () => new Response(F.invalidJson);
  await assert.rejects(
    new CompreFaceVerifier(F.enabled, invalid).compare(jpeg, jpeg),
    FaceComparisonInvalidResponseError,
  );
  await assert.rejects(
    new CompreFaceVerifier(F.enabled).compare(Uint8Array.from(F.invalidJpegs[0]), jpeg),
    FaceComparisonInvalidResponseError,
  );
});

test('CompreFace rejects nonfinite similarities from a decoded upstream response', async () => {
  for (const symbolic of F.nonfinite) {
    const document = structuredClone(F.success);
    document.result[0].face_matches[0].similarity = Number(symbolic);
    // Response.json serializes nonfinite values as null; inject the decoder result to exercise the guard itself.
    const transport: typeof fetch = async () =>
      ({ ok: true, json: async () => document }) as Response;
    await assert.rejects(
      new CompreFaceVerifier(F.enabled, transport).compare(jpeg, jpeg),
      FaceComparisonInvalidResponseError,
    );
  }
});

test('CompreFace aborts a stalled transport and reports only sanitized unavailability', async () => {
  let aborted = false;
  const transport: typeof fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init!.signal!;
      // Keep the test process alive: AbortSignal.timeout uses an unref timer.
      const keepAlive = setTimeout(
        () => reject(new Error(F.upstreamError)),
        F.enabled.timeoutMs * 2,
      );
      signal.addEventListener(
        'abort',
        () => {
          aborted = signal.aborted;
          clearTimeout(keepAlive);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  await assert.rejects(
    new CompreFaceVerifier(F.enabled, transport).compare(jpeg, jpeg),
    FaceComparisonUnavailableError,
  );
  assert.equal(aborted, true);
});

/** CompreFace is evidence, never identity approval. Its key stays on the backend. */
export type CompreFaceConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly origin: string;
      readonly apiKey: string;
      readonly timeoutMs: number;
    };
export class CompreFaceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompreFaceConfigurationError';
  }
}
export class FaceComparisonUnavailableError extends Error {
  constructor() {
    super('Face comparison service is unavailable');
    this.name = 'FaceComparisonUnavailableError';
  }
}
export class FaceComparisonInvalidResponseError extends Error {
  constructor() {
    super('Face comparison returned an invalid or ambiguous result');
    this.name = 'FaceComparisonInvalidResponseError';
  }
}
export function loadCompreFaceConfig(env: NodeJS.ProcessEnv): CompreFaceConfig {
  const enabled = env.COMPREFACE_ENABLED?.trim() || 'false';
  if (enabled === 'false') return { enabled: false };
  if (enabled !== 'true')
    throw new CompreFaceConfigurationError('COMPREFACE_ENABLED must be true or false');
  const endpoint = env.COMPREFACE_ORIGIN?.trim();
  const apiKey = env.COMPREFACE_API_KEY?.trim();
  if (!endpoint || !apiKey)
    throw new CompreFaceConfigurationError('CompreFace origin and API key are required');
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new CompreFaceConfigurationError('COMPREFACE_ORIGIN must be an absolute URL');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  ) {
    throw new CompreFaceConfigurationError(
      'CompreFace requires HTTPS (HTTP only on loopback) and a plain origin',
    );
  }
  const raw = env.COMPREFACE_TIMEOUT_MS?.trim() || '15000';
  if (!/^\d+$/.test(raw)) throw new CompreFaceConfigurationError('Invalid CompreFace timeout');
  const timeoutMs = Number(raw);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new CompreFaceConfigurationError('CompreFace timeout out of range');
  }
  return { enabled: true, origin: url.origin, apiKey, timeoutMs };
}
export interface FaceComparisonEvidence {
  readonly similarity: number;
  readonly faceCount: 1;
  readonly matches: 1;
}
export interface FaceComparisonPort {
  compare(sourceJpeg: Uint8Array, targetJpeg: Uint8Array): Promise<FaceComparisonEvidence>;
}
export class CompreFaceVerifier implements FaceComparisonPort {
  constructor(
    private readonly config: CompreFaceConfig,
    private readonly transport: typeof fetch = fetch,
  ) {}
  async compare(sourceJpeg: Uint8Array, targetJpeg: Uint8Array): Promise<FaceComparisonEvidence> {
    if (!this.config.enabled) throw new FaceComparisonUnavailableError();
    // Cheap envelope check only: CompreFace remains responsible for decoding the image.
    // This is not a substitute for an approved upload size/MIME policy (G5).
    if (!hasJpegEnvelope(sourceJpeg) || !hasJpegEnvelope(targetJpeg)) {
      throw new FaceComparisonInvalidResponseError();
    }
    const form = new FormData();
    const blob = (input: Uint8Array): Blob =>
      new Blob([Uint8Array.from(input)], { type: 'image/jpeg' });
    form.append('source_image', blob(sourceJpeg), 'source.jpg');
    form.append('target_image', blob(targetJpeg), 'target.jpg');
    let response: Response;
    try {
      response = await this.transport(this.config.origin + '/api/v1/verification/verify', {
        method: 'POST',
        headers: { 'x-api-key': this.config.apiKey },
        body: form,
        signal: AbortSignal.timeout(this.config.timeoutMs),
        redirect: 'error',
      });
    } catch {
      throw new FaceComparisonUnavailableError();
    }
    if (!response.ok) throw new FaceComparisonUnavailableError();
    let document: unknown;
    try {
      document = await response.json();
    } catch {
      throw new FaceComparisonInvalidResponseError();
    }
    if (!isRecord(document) || !Array.isArray(document.result) || document.result.length !== 1) {
      throw new FaceComparisonInvalidResponseError();
    }
    const face: unknown = document.result[0];
    if (!isRecord(face) || !Array.isArray(face.face_matches) || face.face_matches.length !== 1) {
      throw new FaceComparisonInvalidResponseError();
    }
    const match: unknown = face.face_matches[0];
    if (
      !isRecord(match) ||
      typeof match.similarity !== 'number' ||
      !Number.isFinite(match.similarity) ||
      match.similarity < 0 ||
      match.similarity > 1
    ) {
      throw new FaceComparisonInvalidResponseError();
    }
    return { similarity: match.similarity, faceCount: 1, matches: 1 };
  }
}
function hasJpegEnvelope(bytes: Uint8Array): boolean {
  const size = bytes.byteLength;
  return (
    size >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[size - 2] === 0xff &&
    bytes[size - 1] === 0xd9
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

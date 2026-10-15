import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ObjectStoragePort } from '../../persistence/ports/object-storage.port';
import type { ObjectStorageConfig } from './object-storage.config';
import { UnavailableObjectStorageAdapter } from './unavailable-object-storage.adapter';

type EnabledConfig = Extract<ObjectStorageConfig, { enabled: true }>;
export class PrivateObjectStorageError extends Error {
  constructor() {
    super('Private object storage operation failed');
    this.name = 'PrivateObjectStorageError';
  }
}
function assertOpaqueKey(key: string): void {
  if (
    !key ||
    key.length > 512 ||
    key.startsWith('/') ||
    key.includes('\\') ||
    key.includes('?') ||
    key.includes('#') ||
    key.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
    Array.from(key).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  ) {
    throw new PrivateObjectStorageError();
  }
}
export class PrivateS3ObjectStorageAdapter implements ObjectStoragePort {
  async deleteObject(key: string): Promise<void> {
    assertOpaqueKey(key);
    try { await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key })); }
    catch { throw new PrivateObjectStorageError(); }
  }
  private readonly client: S3Client;
  constructor(
    private readonly config: EnabledConfig,
    client?: S3Client,
  ) {
    let endpoint: URL;
    try {
      endpoint = new URL(config.endpoint);
    } catch {
      throw new PrivateObjectStorageError();
    }
    if (
      !['http:', 'https:'].includes(endpoint.protocol) ||
      !endpoint.hostname ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.pathname !== '/' ||
      (endpoint.protocol === 'http:' &&
        !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))
    ) {
      throw new PrivateObjectStorageError();
    }
    this.client =
      client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
        maxAttempts: 2,
      });
  }
  async putObject(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<void> {
    assertOpaqueKey(input.key);
    if (!input.bytes.length || !input.contentType.trim() || /[\r\n]/.test(input.contentType)) {
      throw new PrivateObjectStorageError();
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: input.key,
          Body: input.bytes,
          ContentType: input.contentType,
          // No public ACL, public URL, or presigned access.
        }),
      );
    } catch {
      throw new PrivateObjectStorageError();
    }
  }
  async getObject(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    assertOpaqueKey(key);
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      if (!result.Body) throw new PrivateObjectStorageError();
      return {
        bytes: await result.Body.transformToByteArray(),
        contentType: result.ContentType || 'application/octet-stream',
      };
    } catch (error) {
      if (isObjectNotFound(error)) return null;
      throw new PrivateObjectStorageError();
    }
  }
}
function isObjectNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('name' in error)) return false;
  return error.name === 'NoSuchKey' || error.name === 'NotFound';
}
export function createObjectStorageAdapter(config: ObjectStorageConfig): ObjectStoragePort {
  return config.enabled
    ? new PrivateS3ObjectStorageAdapter(config)
    : new UnavailableObjectStorageAdapter();
}

import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { loadObjectStorageConfig } from '../../src/infrastructure/object-storage/object-storage.config';

async function main(): Promise<void> {
  const config = loadObjectStorageConfig(process.env);
  if (!config.enabled || config.endpoint !== 'http://127.0.0.1:9047') {
    throw new Error(
      'This initializer only accepts the isolated messaging compose endpoint on 127.0.0.1:9047',
    );
  }
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
  });
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    } catch (error) {
      if (!(error instanceof Error) || !['NotFound', 'NoSuchBucket'].includes(error.name))
        throw error;
      await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
    }
    console.log('Private local messaging bucket ready');
  } finally {
    client.destroy();
  }
}
void main().catch(() => {
  console.error('Local bucket initialization failed');
  process.exitCode = 1;
});

import 'reflect-metadata';
import { createDatabaseClient } from '../../src/infrastructure/database/database.client';
import { loadObjectStorageConfig } from '../../src/infrastructure/object-storage/object-storage.config';
import { createObjectStorageAdapter } from '../../src/infrastructure/object-storage/private-s3-object-storage.adapter';
import { MessagingRepository } from '../../src/modules/messaging/messaging.repository';
import { MessagingService } from '../../src/modules/messaging/messaging.service';
import type { ObjectStoragePort } from '../../src/persistence/ports/object-storage.port';

async function main(): Promise<void> {
  const userId = process.env.MESSAGING_CRASH_USER_ID;
  const conversationId = process.env.MESSAGING_CRASH_CONVERSATION_ID;
  const image = process.env.MESSAGING_CRASH_IMAGE_BASE64;
  if (!userId || !conversationId || !image) throw new Error('Crash worker input is missing');
  const db = createDatabaseClient({ url: process.env.DATABASE_URL!, maxPoolSize: 1, connectionTimeoutMs: 5000 });
  const storage = createObjectStorageAdapter(loadObjectStorageConfig(process.env));
  const blockingStorage: ObjectStoragePort = {
    putObject: async (input) => {
      await storage.putObject(input);
      if (!process.send) throw new Error('Crash worker requires parent IPC');
      process.send({ type: 'object-written', key: input.key });
      await new Promise<void>(() => {});
    },
    getObject: (key) => storage.getObject(key),
    deleteObject: (key) => storage.deleteObject!(key),
  };
  await new MessagingService(new MessagingRepository(db), blockingStorage).post(userId, conversationId, {
    text: 'process-crash-recovery-check',
    images: [{ contentType: 'image/jpeg', base64: image }],
  });
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : 'Crash worker failed'}\n`);
  process.exitCode = 1;
});

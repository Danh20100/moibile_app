import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { OBJECT_STORAGE_PORT, type ObjectStoragePort } from '../../../persistence/ports/object-storage.port';
import { decodeImage } from '../../listing/services/listing-asset-media.service';
import type { UploadProfileAvatarDto } from '../dto';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

@Injectable()
export class ProfileAvatarService implements OnModuleInit {
  private readonly logger = new Logger(ProfileAvatarService.name);

  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Kysely<Database>,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const completed = await this.reconcilePendingIntents();
      if (completed) this.logger.log(`Reconciled ${completed} pending profile avatar operation(s)`);
    } catch (error) {
      this.logger.warn(`Profile avatar reconciliation remains pending: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async upload(userId: string, dto: UploadProfileAvatarDto) {
    const bytes = decodeImage({
      mediaId: randomUUID(), contentType: dto.contentType, base64: dto.base64,
    });
    if (bytes.length > MAX_AVATAR_BYTES) throw new BadRequestException('Profile avatar must be at most 2 MB');
    if (!this.storage.deleteObject) throw new ServiceUnavailableException('Object storage does not support deletion');

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const extension = dto.contentType === 'image/jpeg' ? 'jpg' : 'png';
    const objectKey = `user-avatars/${userId}/${randomUUID()}.${extension}`;
    await this.createIntent(userId, objectKey, dto.contentType, bytes.length, sha256);

    try {
      await this.commitAvatarUpload(userId, objectKey, dto.contentType, bytes, sha256);
    } catch (error) {
      throw new ServiceUnavailableException('Profile avatar upload is pending reconciliation', { cause: error });
    }

    // The new avatar is canonical after commit. Cleanup is durable and retried on startup if storage is unavailable.
    try {
      await this.finishReplacement(userId);
    } catch (error) {
      this.logger.warn(`Previous avatar cleanup remains pending for user ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    const metadata = await this.readMetadata(userId);
    return { contentType: metadata.contentType, byteSize: metadata.byteSize, updatedAt: metadata.updatedAt };
  }

  async content(userId: string) {
    const metadata = await this.readMetadata(userId);
    const object = await this.storage.getObject(metadata.objectKey);
    if (!object || object.contentType !== metadata.contentType || object.bytes.length !== metadata.byteSize ||
      createHash('sha256').update(object.bytes).digest('hex') !== metadata.sha256) {
      throw new ServiceUnavailableException('Profile avatar is unavailable');
    }
    return {
      contentType: metadata.contentType,
      byteSize: metadata.byteSize,
      updatedAt: metadata.updatedAt,
      base64: Buffer.from(object.bytes).toString('base64'),
    };
  }

  async reconcilePendingIntents(): Promise<number> {
    const pending = await this.db.selectFrom('user_profile_avatar_intents').select('user_id').orderBy('created_at').execute();
    let completed = 0;
    for (const { user_id: userId } of pending) {
      await this.reconcileUser(userId);
      completed++;
    }
    return completed;
  }

  private async createIntent(userId: string, objectKey: string, contentType: 'image/jpeg' | 'image/png', byteSize: number, sha256: string): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      const user = await tx.selectFrom('users').select('user_id').where('user_id', '=', userId).forUpdate().executeTakeFirst();
      if (!user) throw new NotFoundException('User unavailable');
      const pending = await tx.selectFrom('user_profile_avatar_intents').select('user_id').where('user_id', '=', userId).executeTakeFirst();
      if (pending) throw new ServiceUnavailableException('Another profile avatar operation is pending reconciliation');
      const previous = await tx.selectFrom('user_profile_avatars').select('object_key').where('user_id', '=', userId).executeTakeFirst();
      await tx.insertInto('user_profile_avatar_intents').values({
        user_id: userId, operation: 'UPLOAD', object_key: objectKey,
        previous_object_key: previous?.object_key ?? null,
        content_type: contentType, byte_size: byteSize, sha256, created_at: new Date().toISOString(),
      }).execute();
    });
  }

  private async commitAvatarUpload(userId: string, objectKey: string, contentType: 'image/jpeg' | 'image/png', bytes: Buffer, sha256: string): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      await tx.selectFrom('users').select('user_id').where('user_id', '=', userId).forUpdate().executeTakeFirstOrThrow();
      const intent = await tx.selectFrom('user_profile_avatar_intents').selectAll().where('user_id', '=', userId).forUpdate().executeTakeFirst();
      if (!intent || intent.operation !== 'UPLOAD' || intent.object_key !== objectKey || intent.sha256 !== sha256 ||
        intent.content_type !== contentType || intent.byte_size !== bytes.length) {
        throw new ServiceUnavailableException('Profile avatar upload intent changed');
      }

      await this.storage.putObject({ key: objectKey, bytes, contentType });
      const now = new Date().toISOString();
      await tx.insertInto('user_profile_avatars').values({
        user_id: userId, object_key: objectKey, content_type: contentType,
        byte_size: bytes.length, sha256, updated_at: now,
      }).onConflict((conflict) => conflict.column('user_id').doUpdateSet({
        object_key: objectKey, content_type: contentType, byte_size: bytes.length,
        sha256, updated_at: now,
      })).execute();
      await tx.updateTable('user_profile_avatar_intents').set({ operation: 'DELETE_PREVIOUS' })
        .where('user_id', '=', userId).execute();
    });
  }

  private async finishReplacement(userId: string): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      await tx.selectFrom('users').select('user_id').where('user_id', '=', userId).forUpdate().executeTakeFirstOrThrow();
      await this.reconcileLockedUser(tx, userId);
    });
  }

  private async reconcileUser(userId: string): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      await tx.selectFrom('users').select('user_id').where('user_id', '=', userId).forUpdate().executeTakeFirstOrThrow();
      await this.reconcileLockedUser(tx, userId);
    });
  }

  private async reconcileLockedUser(tx: Kysely<Database> | Transaction<Database>, userId: string): Promise<void> {
    const intent = await tx.selectFrom('user_profile_avatar_intents').selectAll().where('user_id', '=', userId).forUpdate().executeTakeFirst();
    if (!intent) return;
    if (!this.storage.deleteObject) throw new Error('Object storage does not support deletion');

    if (intent.operation === 'UPLOAD') {
      // The canonical avatar update and phase change share a transaction. UPLOAD means the old avatar is still canonical.
      await this.storage.deleteObject(intent.object_key);
    } else {
      const current = await tx.selectFrom('user_profile_avatars').select('object_key').where('user_id', '=', userId).executeTakeFirst();
      if (current?.object_key !== intent.object_key) throw new Error('Committed avatar does not match its cleanup intent');
      if (intent.previous_object_key) await this.storage.deleteObject(intent.previous_object_key);
    }
    await tx.deleteFrom('user_profile_avatar_intents').where('user_id', '=', userId).execute();
  }

  private async readMetadata(userId: string) {
    const row = await this.db.selectFrom('user_profile_avatars').selectAll().where('user_id', '=', userId).executeTakeFirst();
    if (!row) throw new NotFoundException('Profile avatar unavailable');
    return {
      objectKey: row.object_key, contentType: row.content_type, byteSize: row.byte_size,
      sha256: row.sha256, updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}

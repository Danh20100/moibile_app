import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { decode as decodeJpeg } from 'jpeg-js';
import type { Kysely, Transaction } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { OBJECT_STORAGE_PORT, type ObjectStoragePort } from '../../../persistence/ports/object-storage.port';
import type { ReorderListingAssetMediaDto, UploadListingAssetMediaDto } from '../dto/listing-asset-media.dto';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
type Media = { id: string; contentType: string; byteSize: number; position: number; createdAt: string; isPublic: boolean };
type UploadPlan = { existing?: Media };

@Injectable()
export class ListingAssetMediaService implements OnModuleInit {
  private readonly logger = new Logger(ListingAssetMediaService.name);
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Kysely<Database>,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.reconcilePendingIntents();
    } catch (error) {
      this.logger.warn(`Listing photo operation reconciliation remains pending: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async reconcilePendingIntents(): Promise<number> {
    const intents = await this.db.selectFrom('listing_asset_media_intents').selectAll().orderBy('created_at').execute();
    let completed = 0;
    for (const intent of intents) {
      if (intent.operation === 'DELETE') await this.completeDeleteIntent(intent.listing_id, intent.media_id);
      else await this.cleanupUploadIntent(intent.listing_id, intent.media_id);
      completed++;
    }
    return completed;
  }

  async list(listingId: string): Promise<Media[]> {
    const rows = await this.db.selectFrom('listing_asset_media').selectAll().where('listing_id', '=', listingId).orderBy('position').execute();
    return rows.map((row) => ({ id: row.media_id, contentType: row.content_type, byteSize: row.byte_size, position: row.position, createdAt: new Date(row.created_at).toISOString(), isPublic: row.public_approved }));
  }

  async publicIds(listingId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('listing_asset_media as media')
      .innerJoin('listings', 'listings.listing_id', 'media.listing_id')
      .leftJoin('listing_asset_media_intents as intent', 'intent.media_id', 'media.media_id')
      .select('media.media_id').where('media.listing_id', '=', listingId)
      .where('media.public_approved', '=', true).where('listings.status', '=', 'PUBLISHED')
      .where('intent.media_id', 'is', null)
      .orderBy('media.position').execute();
    return rows.map((row) => row.media_id);
  }

  async publicContent(listingId: string, mediaId: string) {
    const row = await this.db.selectFrom('listing_asset_media as media')
      .innerJoin('listings', 'listings.listing_id', 'media.listing_id')
      .leftJoin('listing_asset_media_intents as intent', 'intent.media_id', 'media.media_id')
      .selectAll('media').where('media.listing_id', '=', listingId).where('media.media_id', '=', mediaId)
      .where('media.public_approved', '=', true).where('listings.status', '=', 'PUBLISHED')
      .where('intent.media_id', 'is', null).executeTakeFirst();
    if (!row) throw new NotFoundException('Public listing photo unavailable');
    const object = await this.storage.getObject(row.object_key);
    if (!object || object.contentType !== row.content_type || object.bytes.length !== row.byte_size)
      throw new ServiceUnavailableException('Public listing photo unavailable');
    return { contentType: row.content_type, base64: Buffer.from(object.bytes).toString('base64') };
  }

  async setPublic(listingId: string, mediaId: string, isPublic: boolean): Promise<Media> {
    const row = await this.db.transaction().execute(async (tx) => {
      await tx.selectFrom('listings').select('listing_id').where('listing_id', '=', listingId).forUpdate().executeTakeFirstOrThrow();
      await this.assertNoPendingIntent(tx, listingId);
      return tx.updateTable('listing_asset_media').set({ public_approved: isPublic })
        .where('listing_id', '=', listingId).where('media_id', '=', mediaId).returningAll().executeTakeFirst();
    });
    if (!row) throw new NotFoundException('Asset photo unavailable');
    return { id: row.media_id, contentType: row.content_type, byteSize: row.byte_size, position: row.position,
      createdAt: new Date(row.created_at).toISOString(), isPublic: row.public_approved };
  }

  async upload(listingId: string, dto: UploadListingAssetMediaDto): Promise<Media> {
    const bytes = decodeImage(dto);
    const extension = dto.contentType === 'image/jpeg' ? 'jpg' : 'png';
    const objectKey = `rental-assets/${listingId}/${dto.mediaId}.${extension}`;
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    if (!this.storage.deleteObject) throw new ServiceUnavailableException('Object storage does not support deletion');
    const plan = await this.ensureUploadIntent(listingId, dto, bytes, objectKey, contentHash);
    if (plan.existing) return plan.existing;
    try {
      await this.storage.putObject({ key: objectKey, bytes, contentType: dto.contentType });
      return await this.db.transaction().execute(async (tx) => {
        await tx.selectFrom('listings').select('listing_id').where('listing_id', '=', listingId).forUpdate().executeTakeFirstOrThrow();
        const intent = await tx.selectFrom('listing_asset_media_intents').selectAll()
          .where('listing_id', '=', listingId).where('media_id', '=', dto.mediaId).forUpdate().executeTakeFirst();
        if (!intent || intent.operation !== 'UPLOAD' || intent.content_hash !== contentHash || intent.object_key !== objectKey)
          throw new ConflictException('Asset photo upload intent changed before completion');
        const row = await tx.insertInto('listing_asset_media').values({
          media_id: dto.mediaId, listing_id: listingId, object_key: objectKey, content_type: dto.contentType,
          byte_size: bytes.length, position: intent.position, public_approved: false, created_at: new Date().toISOString(),
        }).returningAll().executeTakeFirstOrThrow();
        await tx.deleteFrom('listing_asset_media_intents').where('listing_id', '=', listingId).where('media_id', '=', dto.mediaId).execute();
        return this.toMedia(row);
      });
    } catch (error) {
      throw new ServiceUnavailableException('Asset photo upload pending reconciliation', { cause: error });
    }
  }

  async content(listingId: string, mediaId: string) {
    const row = await this.db.selectFrom('listing_asset_media').selectAll().where('listing_id', '=', listingId).where('media_id', '=', mediaId).executeTakeFirst();
    if (!row) throw new NotFoundException('Asset photo unavailable');
    const object = await this.storage.getObject(row.object_key);
    if (!object || object.contentType !== row.content_type || object.bytes.length !== row.byte_size)
      throw new ServiceUnavailableException('Asset photo unavailable');
    return { contentType: row.content_type, base64: Buffer.from(object.bytes).toString('base64') };
  }

  async reorder(listingId: string, dto: ReorderListingAssetMediaDto): Promise<Media[]> {
    return this.db.transaction().execute(async (tx) => {
      await tx.selectFrom('listings').select('listing_id').where('listing_id', '=', listingId).forUpdate().executeTakeFirstOrThrow();
      await this.assertNoPendingIntent(tx, listingId);
      const current = await tx.selectFrom('listing_asset_media').select('media_id').where('listing_id', '=', listingId).orderBy('position').execute();
      const expected = current.map((row) => row.media_id).sort();
      const supplied = [...dto.mediaIds].sort();
      if (expected.length !== supplied.length || expected.some((id, index) => id !== supplied[index]))
        throw new BadRequestException('Photo order must include every current photo exactly once');
      for (let index = 0; index < dto.mediaIds.length; index++)
        await tx.updateTable('listing_asset_media').set({ position: index }).where('listing_id', '=', listingId).where('media_id', '=', dto.mediaIds[index]!).execute();
      const rows = await tx.selectFrom('listing_asset_media').selectAll().where('listing_id', '=', listingId).orderBy('position').execute();
      return rows.map((row) => this.toMedia(row));
    });
  }

  async remove(listingId: string, mediaId: string): Promise<void> {
    await this.ensureDeleteIntent(listingId, mediaId);
    await this.completeDeleteIntent(listingId, mediaId);
  }

  private async ensureUploadIntent(listingId: string, dto: UploadListingAssetMediaDto, bytes: Buffer, objectKey: string, contentHash: string): Promise<UploadPlan> {
    return this.db.transaction().execute(async (tx) => {
      await tx.selectFrom('listings').select('listing_id').where('listing_id', '=', listingId).forUpdate().executeTakeFirstOrThrow();
      const pendingForMedia = await tx.selectFrom('listing_asset_media_intents').selectAll().where('media_id', '=', dto.mediaId).executeTakeFirst();
      if (pendingForMedia) {
        if (pendingForMedia.listing_id !== listingId) throw new ConflictException('Media ID already belongs to a different Listing operation');
        if (pendingForMedia.operation !== 'UPLOAD') throw new ServiceUnavailableException('Asset photo removal pending reconciliation');
        if (pendingForMedia.content_hash !== contentHash || pendingForMedia.object_key !== objectKey ||
          pendingForMedia.content_type !== dto.contentType || pendingForMedia.byte_size !== bytes.length)
          throw new ConflictException('Media ID retry content differs');
        return {};
      }
      const pendingForListing = await tx.selectFrom('listing_asset_media_intents').select('media_id').where('listing_id', '=', listingId).executeTakeFirst();
      if (pendingForListing) throw new ServiceUnavailableException('Another Asset photo operation is pending reconciliation');
      const existing = await tx.selectFrom('listing_asset_media').selectAll().where('media_id', '=', dto.mediaId).executeTakeFirst();
      if (existing) {
        if (existing.listing_id !== listingId || existing.byte_size !== bytes.length || existing.content_type !== dto.contentType)
          throw new ConflictException('Media ID already belongs to different content');
        const object = await this.storage.getObject(existing.object_key);
        if (!object || !Buffer.from(object.bytes).equals(bytes)) throw new ConflictException('Media ID retry content differs');
        return { existing: this.toMedia(existing) };
      }
      const current = await tx.selectFrom('listing_asset_media').select('media_id').where('listing_id', '=', listingId).orderBy('position').execute();
      if (current.length >= 10) throw new BadRequestException('At most 10 asset photos are allowed');
      await tx.insertInto('listing_asset_media_intents').values({
        media_id: dto.mediaId, listing_id: listingId, operation: 'UPLOAD', object_key: objectKey,
        content_type: dto.contentType, byte_size: bytes.length, position: current.length,
        content_hash: contentHash, created_at: new Date().toISOString(),
      }).execute();
      return {};
    });
  }

  private async ensureDeleteIntent(listingId: string, mediaId: string): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      await tx.selectFrom('listings').select('listing_id').where('listing_id', '=', listingId).forUpdate().executeTakeFirstOrThrow();
      const existingIntent = await tx.selectFrom('listing_asset_media_intents').selectAll().where('listing_id', '=', listingId).executeTakeFirst();
      if (existingIntent) {
        if (existingIntent.operation === 'DELETE' && existingIntent.media_id === mediaId) return;
        throw new ServiceUnavailableException('Another Asset photo operation is pending reconciliation');
      }
      const row = await tx.selectFrom('listing_asset_media').selectAll().where('listing_id', '=', listingId).where('media_id', '=', mediaId).forUpdate().executeTakeFirst();
      if (!row) throw new NotFoundException('Asset photo unavailable');
      await tx.insertInto('listing_asset_media_intents').values({
        media_id: row.media_id, listing_id: row.listing_id, object_key: row.object_key,
        operation: 'DELETE', content_type: row.content_type, byte_size: row.byte_size, position: row.position,
        content_hash: null,
        created_at: new Date().toISOString(),
      }).execute();
    });
  }

  private async completeDeleteIntent(listingId: string, mediaId: string): Promise<void> {
    try {
      await this.db.transaction().execute(async (tx) => {
        await tx.selectFrom('listings').select('listing_id').where('listing_id', '=', listingId).forUpdate().executeTakeFirstOrThrow();
        const intent = await tx.selectFrom('listing_asset_media_intents').selectAll()
          .where('listing_id', '=', listingId).where('media_id', '=', mediaId).forUpdate().executeTakeFirst();
        if (!intent) return;
        if (intent.operation !== 'DELETE') throw new ConflictException('Asset photo intent is not a deletion');
        if (!this.storage.deleteObject) throw new Error('Object storage does not support deletion');
        // Intent is committed in an earlier transaction. If this transaction/process fails,
        // the durable intent remains and a restart or retry can safely repeat the idempotent delete.
        await this.storage.deleteObject(intent.object_key);
        await tx.deleteFrom('listing_asset_media').where('listing_id', '=', listingId).where('media_id', '=', mediaId).execute();
        const tail = await tx.selectFrom('listing_asset_media').select('media_id').where('listing_id', '=', listingId).where('position', '>', intent.position).orderBy('position').execute();
        for (const [index, item] of tail.entries()) await tx.updateTable('listing_asset_media').set({ position: intent.position + index }).where('listing_id', '=', listingId).where('media_id', '=', item.media_id).execute();
        await tx.deleteFrom('listing_asset_media_intents').where('listing_id', '=', listingId).where('media_id', '=', mediaId).execute();
      });
    } catch (error) {
      throw new ServiceUnavailableException('Asset photo removal pending reconciliation', { cause: error });
    }
  }

  private async cleanupUploadIntent(listingId: string, mediaId: string): Promise<void> {
    try {
      await this.db.transaction().execute(async (tx) => {
        await tx.selectFrom('listings').select('listing_id').where('listing_id', '=', listingId).forUpdate().executeTakeFirstOrThrow();
        const intent = await tx.selectFrom('listing_asset_media_intents').selectAll()
          .where('listing_id', '=', listingId).where('media_id', '=', mediaId).forUpdate().executeTakeFirst();
        if (!intent || intent.operation !== 'UPLOAD') return;
        const committed = await tx.selectFrom('listing_asset_media').select('media_id').where('listing_id', '=', listingId).where('media_id', '=', mediaId).executeTakeFirst();
        if (!committed) {
          if (!this.storage.deleteObject) throw new Error('Object storage does not support deletion');
          await this.storage.deleteObject(intent.object_key);
        }
        await tx.deleteFrom('listing_asset_media_intents').where('listing_id', '=', listingId).where('media_id', '=', mediaId).execute();
      });
    } catch (error) {
      throw new ServiceUnavailableException('Asset photo upload pending reconciliation', { cause: error });
    }
  }

  private async assertNoPendingIntent(tx: Kysely<Database> | Transaction<Database>, listingId: string): Promise<void> {
    const intent = await tx.selectFrom('listing_asset_media_intents').select('media_id').where('listing_id', '=', listingId).executeTakeFirst();
    if (intent) throw new ServiceUnavailableException('Asset photo operation pending reconciliation');
  }

  private toMedia(row: { media_id: string; content_type: string; byte_size: number; position: number; created_at: Date | string; public_approved: boolean }): Media {
    return { id: row.media_id, contentType: row.content_type, byteSize: row.byte_size, position: row.position,
      createdAt: new Date(row.created_at).toISOString(), isPublic: row.public_approved };
  }
}

export function decodeImage(dto: UploadListingAssetMediaDto): Buffer {
  if (dto.base64.length > 6990508 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(dto.base64))
    throw new BadRequestException('Invalid image encoding');
  const bytes = Buffer.from(dto.base64, 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.toString('base64') !== dto.base64) throw new BadRequestException('Image must be at most 5 MB');
  try {
    if (dto.contentType === 'image/jpeg') {
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new Error();
      decodeJpeg(bytes, { tolerantDecoding: false, maxResolutionInMP: 16, maxMemoryUsageInMB: 128 });
    } else validatePng(bytes);
  } catch { throw new BadRequestException('Image content is invalid or exceeds 16 megapixels'); }
  return bytes;
}

function validatePng(bytes: Buffer): void {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error();
  let offset = 8, width = 0, height = 0, channels = 0, bitDepth = 0, sawHeader = false, sawEnd = false;
  const idat: Buffer[] = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8), end = offset + 12 + length;
    if (end > bytes.length) throw new Error();
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (!sawHeader) {
      if (type !== 'IHDR' || length !== 13) throw new Error();
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]!;
      const color = data[9]!; channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color] ?? 0;
      if (!width || !height || width * height > MAX_PIXELS || !channels || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new Error();
      if (!(color === 0 ? [1, 2, 4, 8, 16] : color === 3 ? [1, 2, 4, 8] : [8, 16]).includes(bitDepth)) throw new Error();
      sawHeader = true;
    }
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') { if (length !== 0 || end !== bytes.length) throw new Error(); sawEnd = true; break; }
    offset = end;
  }
  if (!sawHeader || !sawEnd || !idat.length) throw new Error();
  const rowBytes = Math.ceil(width * channels * bitDepth / 8), expected = (rowBytes + 1) * height;
  const decoded = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  if (decoded.length !== expected) throw new Error();
  for (let row = 0; row < height; row++) if (decoded[row * (rowBytes + 1)]! > 4) throw new Error();
}

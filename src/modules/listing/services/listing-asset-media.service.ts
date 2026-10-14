import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { inflateSync } from 'node:zlib';
import { decode as decodeJpeg } from 'jpeg-js';
import type { Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { OBJECT_STORAGE_PORT, type ObjectStoragePort } from '../../../persistence/ports/object-storage.port';
import type { ReorderListingAssetMediaDto, UploadListingAssetMediaDto } from '../dto/listing-asset-media.dto';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
type Media = { id: string; contentType: string; byteSize: number; position: number; createdAt: string };

@Injectable()
export class ListingAssetMediaService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Kysely<Database>,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  async list(listingId: string): Promise<Media[]> {
    const rows = await this.db.selectFrom('listing_asset_media').selectAll().where('listing_id', '=', listingId).orderBy('position').execute();
    return rows.map((row) => ({ id: row.media_id, contentType: row.content_type, byteSize: row.byte_size, position: row.position, createdAt: new Date(row.created_at).toISOString() }));
  }

  async upload(listingId: string, dto: UploadListingAssetMediaDto): Promise<Media> {
    const bytes = decodeImage(dto);
    const extension = dto.contentType === 'image/jpeg' ? 'jpg' : 'png';
    const objectKey = `rental-assets/${listingId}/${dto.mediaId}.${extension}`;
    let uploaded = false;
    try {
      return await this.db.transaction().execute(async (tx) => {
        await tx.selectFrom('listings').select('listing_id').where('listing_id', '=', listingId).forUpdate().executeTakeFirstOrThrow();
        const existing = await tx.selectFrom('listing_asset_media').selectAll().where('media_id', '=', dto.mediaId).executeTakeFirst();
        if (existing) {
          if (existing.listing_id !== listingId || existing.byte_size !== bytes.length || existing.content_type !== dto.contentType)
            throw new ConflictException('Media ID already belongs to different content');
          const object = await this.storage.getObject(existing.object_key);
          if (!object || !Buffer.from(object.bytes).equals(bytes)) throw new ConflictException('Media ID retry content differs');
          return { id: existing.media_id, contentType: existing.content_type, byteSize: existing.byte_size, position: existing.position, createdAt: new Date(existing.created_at).toISOString() };
        }
        const current = await tx.selectFrom('listing_asset_media').select('media_id').where('listing_id', '=', listingId).orderBy('position').execute();
        if (current.length >= 10) throw new BadRequestException('At most 10 asset photos are allowed');
        await this.storage.putObject({ key: objectKey, bytes, contentType: dto.contentType });
        uploaded = true;
        const row = await tx.insertInto('listing_asset_media').values({
          media_id: dto.mediaId, listing_id: listingId, object_key: objectKey, content_type: dto.contentType,
          byte_size: bytes.length, position: current.length, created_at: new Date().toISOString(),
        }).returningAll().executeTakeFirstOrThrow();
        return { id: row.media_id, contentType: row.content_type, byteSize: row.byte_size, position: row.position, createdAt: new Date(row.created_at).toISOString() };
      });
    } catch (error) {
      // shortcut: interrupted PUTs can leave an unindexed object; stable media IDs overwrite it on retry, add bucket reconciliation if abandoned drafts become common.
      if (uploaded) await this.storage.deleteObject?.(objectKey).catch(() => undefined);
      throw error;
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
    const current = await this.db.selectFrom('listing_asset_media').select('media_id').where('listing_id', '=', listingId).orderBy('position').execute();
    const expected = current.map((row) => row.media_id).sort();
    const supplied = [...dto.mediaIds].sort();
    if (expected.length !== supplied.length || expected.some((id, index) => id !== supplied[index]))
      throw new BadRequestException('Photo order must include every current photo exactly once');
    await this.db.transaction().execute(async (tx) => {
      for (let index = 0; index < dto.mediaIds.length; index++)
        await tx.updateTable('listing_asset_media').set({ position: index }).where('listing_id', '=', listingId).where('media_id', '=', dto.mediaIds[index]!).execute();
    });
    return this.list(listingId);
  }

  async remove(listingId: string, mediaId: string): Promise<void> {
    const row = await this.db.selectFrom('listing_asset_media').selectAll().where('listing_id', '=', listingId).where('media_id', '=', mediaId).executeTakeFirst();
    if (!row) throw new NotFoundException('Asset photo unavailable');
    const object = await this.storage.getObject(row.object_key);
    if (!object || object.contentType !== row.content_type || object.bytes.length !== row.byte_size)
      throw new ServiceUnavailableException('Asset photo unavailable');
    await this.storage.deleteObject?.(row.object_key);
    try {
      await this.db.transaction().execute(async (tx) => {
        await tx.deleteFrom('listing_asset_media').where('listing_id', '=', listingId).where('media_id', '=', mediaId).execute();
        const tail = await tx.selectFrom('listing_asset_media').select('media_id').where('listing_id', '=', listingId).where('position', '>', row.position).orderBy('position').execute();
        for (const [index, item] of tail.entries()) await tx.updateTable('listing_asset_media').set({ position: row.position + index }).where('media_id', '=', item.media_id).execute();
      });
    } catch (error) {
      try {
        await this.storage.putObject({ key: row.object_key, bytes: object.bytes, contentType: row.content_type });
      } catch (restoreError) {
        // shortcut: failed compensation leaves metadata for operator reconciliation; add durable delete intents for crash-safe removal.
        throw new ServiceUnavailableException('Asset photo removal needs reconciliation', { cause: restoreError });
      }
      throw error;
    }
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

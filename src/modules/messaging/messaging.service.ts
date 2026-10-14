import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { decode } from 'jpeg-js';
import { randomUUID } from 'node:crypto';
import {
  OBJECT_STORAGE_PORT,
  type ObjectStoragePort,
} from '../../persistence/ports/object-storage.port';
import { MessagingRepository } from './messaging.repository';
import type { PostMessageDto } from './messaging.dto';

export function decodeMessageImages(dto: PostMessageDto): Buffer[] {
  if ((dto.text?.length ?? 0) > 4000 || (dto.images?.length ?? 0) > 5)
    throw new BadRequestException('Message exceeds limits');
  const images = (dto.images ?? []).map((image) => {
    if (
      image.contentType !== 'image/jpeg' ||
      image.base64.length > 2666668 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(image.base64)
    ) {
      throw new BadRequestException('Invalid JPEG encoding');
    }
    const bytes = Buffer.from(image.base64, 'base64');
    if (
      bytes.length < 4 ||
      bytes.length > 2000000 ||
      bytes.toString('base64') !== image.base64 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[2] !== 255 ||
      bytes.at(-2) !== 255 ||
      bytes.at(-1) !== 217
    ) {
      throw new BadRequestException('Invalid JPEG signature or size');
    }
    try {
      // Bound decoded allocations as well as compressed bytes; Android prepares at most 1280px.
      decode(bytes, { tolerantDecoding: false, maxResolutionInMP: 16, maxMemoryUsageInMB: 128 });
    } catch {
      throw new BadRequestException('Invalid or excessive JPEG content');
    }
    return bytes;
  });
  if (!dto.text?.trim() && !images.length) throw new BadRequestException('Message is empty');
  return images;
}
const iso = (value: string | Date): string => new Date(value).toISOString();

@Injectable()
export class MessagingService {
  constructor(
    @Inject(MessagingRepository) private readonly repo: MessagingRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  async list(userId: string) {
    const rows = await this.repo.db
      .selectFrom('messaging_conversations as c')
      .innerJoin('messaging_participants as p', 'p.conversation_id', 'c.conversation_id')
      .select([
        'c.conversation_id',
        'c.inquiry_id',
        'c.tenancy_id',
        'c.created_at',
        'p.last_read_at',
      ])
      .where('p.user_id', '=', userId)
      .orderBy('c.created_at', 'desc')
      .execute();
    return Promise.all(
      rows.map(async (row) => {
        const participants = await this.repo.db
          .selectFrom('messaging_participants as p')
          .leftJoin('user_profiles as u', 'u.user_id', 'p.user_id')
          .select(['p.user_id', 'u.display_name', 'p.last_read_at'])
          .where('p.conversation_id', '=', row.conversation_id)
          .execute();
        return {
          id: row.conversation_id,
          contextType: row.inquiry_id ? 'inquiry' : 'tenancy',
          contextId: row.inquiry_id ?? row.tenancy_id,
          createdAt: iso(row.created_at),
          lastReadAt: row.last_read_at ? iso(row.last_read_at) : null,
          participants: participants.map((p) => ({
            userId: p.user_id,
            displayName: p.display_name ?? 'Participant',
            lastReadAt: p.last_read_at ? iso(p.last_read_at) : null,
          })),
        };
      }),
    );
  }
  async messages(userId: string, id: string) {
    await this.repo.assertParticipant(userId, id);
    const rows = await this.repo.db
      .selectFrom('messaging_messages')
      .selectAll()
      .where('conversation_id', '=', id)
      .orderBy('created_at', 'desc')
      .orderBy('message_id', 'desc')
      .execute();
    return Promise.all(
      rows.reverse().map(async (row) => {
        const attachments = await this.repo.db
          .selectFrom('messaging_attachments')
          .select(['attachment_id', 'byte_size', 'content_type'])
          .where('message_id', '=', row.message_id)
          .execute();
        return {
          id: row.message_id,
          conversationId: id,
          senderUserId: row.sender_user_id,
          text: row.text,
          createdAt: iso(row.created_at),
          delivery: 'server',
          attachments: attachments.map((a) => ({
            id: a.attachment_id,
            byteSize: a.byte_size,
            contentType: a.content_type,
          })),
        };
      }),
    );
  }
  async post(userId: string, id: string, dto: PostMessageDto) {
    await this.repo.assertParticipant(userId, id);
    const bytes = decodeMessageImages(dto);
    const messageId = randomUUID();
    const attachments = bytes.map((image) => ({
      attachment_id: randomUUID(),
      message_id: messageId,
      object_key: `messaging/${id}/${messageId}/${randomUUID()}.jpg`,
      byte_size: image.length,
      content_type: 'image/jpeg',
    }));
    const uploaded: string[] = [];
    try {
      for (let index = 0; index < bytes.length; index++) {
        uploaded.push(attachments[index].object_key);
        await this.storage.putObject({
          key: attachments[index].object_key,
          bytes: bytes[index],
          contentType: 'image/jpeg',
        });
      }
      const createdAt = new Date().toISOString();
      await this.repo.db.transaction().execute(async (tx) => {
        await tx
          .insertInto('messaging_messages')
          .values({
            message_id: messageId,
            conversation_id: id,
            sender_user_id: userId,
            text: dto.text?.trim() ?? '',
            created_at: createdAt,
          })
          .execute();
        if (attachments.length)
          await tx.insertInto('messaging_attachments').values(attachments).execute();
      });
      return {
        id: messageId,
        conversationId: id,
        senderUserId: userId,
        text: dto.text?.trim() ?? '',
        createdAt,
        delivery: 'server',
        attachments: attachments.map((a) => ({
          id: a.attachment_id,
          byteSize: a.byte_size,
          contentType: a.content_type,
        })),
      };
    } catch {
      await Promise.allSettled(uploaded.map((key) => this.storage.deleteObject?.(key)));
      throw new ServiceUnavailableException('Message was not saved; retry');
    }
  }
  async read(userId: string, id: string) {
    await this.repo.assertParticipant(userId, id);
    // A read watermark never advances beyond the latest server message.
    const latest = await this.repo.db
      .selectFrom('messaging_messages')
      .select('created_at')
      .where('conversation_id', '=', id)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    if (latest) await this.repo.advanceReadWatermark(id, userId, iso(latest.created_at));
    return { lastReadAt: latest ? iso(latest.created_at) : null };
  }
  async attachment(userId: string, id: string, attachmentId: string) {
    await this.repo.assertParticipant(userId, id);
    const row = await this.repo.db
      .selectFrom('messaging_attachments as a')
      .innerJoin('messaging_messages as m', 'm.message_id', 'a.message_id')
      .select(['a.object_key', 'a.byte_size'])
      .where('m.conversation_id', '=', id)
      .where('a.attachment_id', '=', attachmentId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Attachment unavailable');
    try {
      const object = await this.storage.getObject(row.object_key);
      if (
        !object ||
        object.bytes.length !== row.byte_size ||
        object.bytes.length > 2000000 ||
        object.contentType !== 'image/jpeg'
      ) {
        throw new ServiceUnavailableException('Attachment unavailable');
      }
      return { contentType: 'image/jpeg', base64: Buffer.from(object.bytes).toString('base64') };
    } catch {
      throw new ServiceUnavailableException('Attachment unavailable');
    }
  }
}

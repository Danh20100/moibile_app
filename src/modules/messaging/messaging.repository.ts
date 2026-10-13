import {
  ForbiddenException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../infrastructure/database/database.tokens';
import type { Database } from '../../infrastructure/database/schema.types';

@Injectable()
export class MessagingRepository {
  constructor(@Inject(DATABASE_CLIENT) readonly db: Kysely<Database>) {}

  async assertParticipant(userId: string, id: string): Promise<void> {
    const row = await this.db
      .selectFrom('messaging_participants')
      .select('user_id')
      .where('conversation_id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!row) throw new ForbiddenException('Conversation access denied');
  }

  async open(userId: string, type: 'inquiry' | 'tenancy', contextId: string): Promise<string> {
    return this.db.transaction().execute(async (tx) => {
      // Serialize context creation so simultaneous opens reuse the same participant snapshot.
      await sql`select pg_advisory_xact_lock(hashtextextended(${type + contextId}, 0))`.execute(tx);
      const field = type === 'inquiry' ? 'inquiry_id' : 'tenancy_id';
      const existing = await tx
        .selectFrom('messaging_conversations')
        .select('conversation_id')
        .where(field, '=', contextId)
        .executeTakeFirst();
      if (existing) {
        const member = await tx
          .selectFrom('messaging_participants')
          .select('user_id')
          .where('conversation_id', '=', existing.conversation_id)
          .where('user_id', '=', userId)
          .executeTakeFirst();
        if (!member) throw new ForbiddenException('Conversation access denied');
        return existing.conversation_id;
      }
      let parties: (string | null)[];
      if (type === 'inquiry') {
        const row = await tx
          .selectFrom('inquiries as i')
          .innerJoin('listings as l', 'l.listing_id', 'i.listing_id')
          .innerJoin('rooms as r', 'r.room_id', 'l.room_id')
          .innerJoin('properties as p', 'p.property_id', 'r.property_id')
          .innerJoin('organizations as o', 'o.organization_id', 'p.organization_id')
          .select(['i.sender_user_id', 'o.primary_owner_user_id'])
          .where('i.inquiry_id', '=', contextId)
          .executeTakeFirst();
        parties = row ? [row.sender_user_id, row.primary_owner_user_id] : [];
      } else {
        const row = await tx
          .selectFrom('tenancies as t')
          .innerJoin('rooms as r', 'r.room_id', 't.room_id')
          .innerJoin('properties as p', 'p.property_id', 'r.property_id')
          .innerJoin('organizations as o', 'o.organization_id', 'p.organization_id')
          .select('o.primary_owner_user_id')
          .where('t.tenancy_id', '=', contextId)
          .executeTakeFirst();
        const tenants = await tx
          .selectFrom('tenancy_participants')
          .select('user_id')
          .where('tenancy_id', '=', contextId)
          .execute();
        parties = row ? [row.primary_owner_user_id, ...tenants.map((p) => p.user_id)] : [];
      }
      if (!parties.includes(userId)) throw new ForbiddenException('Context access denied');
      if (
        parties.length < 2 ||
        parties.some((p) => !p) ||
        new Set(parties).size !== parties.length
      ) {
        throw new UnprocessableEntityException('Context has missing or ambiguous participants');
      }
      const ids = parties as string[];
      const verified = await tx
        .selectFrom('auth_identities')
        .select('user_id')
        .distinct()
        .where('user_id', 'in', ids)
        .execute();
      if (verified.length !== ids.length)
        throw new UnprocessableEntityException('All participants need verified accounts');
      const id = randomUUID();
      await tx
        .insertInto('messaging_conversations')
        .values({
          conversation_id: id,
          inquiry_id: type === 'inquiry' ? contextId : null,
          tenancy_id: type === 'tenancy' ? contextId : null,
          created_at: new Date().toISOString(),
        })
        .execute();
      await tx
        .insertInto('messaging_participants')
        .values(ids.map((user_id) => ({ conversation_id: id, user_id, last_read_at: null })))
        .execute();
      return id;
    });
  }
}

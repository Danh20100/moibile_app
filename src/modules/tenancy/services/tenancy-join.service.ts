import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';

export const validJoinToken = (value: string): boolean => /^[a-f0-9]{64}$/.test(value);
export const joinTokenHash = (value: string): string => createHash('sha256').update(value).digest('hex');

interface JoinTarget {
  tenancy_id: string;
  room_id: string;
  participant_id: string;
  role: string;
  user_id: string | null;
  left_at: Date | null;
  status: string;
  room_state: string;
  room_label: string;
  property_name: string;
}

interface InviteRow {
  invitation_id: string;
  tenancy_id: string;
  participant_id: string;
  token_hash: string;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
}

@Injectable()
export class TenancyJoinService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: Kysely<Database>) {}

  async issue(tenancyId: string, operatorId: string) {
    const token = randomBytes(32).toString('hex');
    const hash = joinTokenHash(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const issued = await this.db.transaction().execute(async trx => {
      const rows = await sql<JoinTarget>`
        SELECT t.tenancy_id, t.room_id, tp.tenancy_participant_id AS participant_id,
          tp.role, tp.user_id, tp.left_at, t.status,
          r.operational_state AS room_state, r.name_or_label AS room_label,
          p.name AS property_name
        FROM tenancies t
        JOIN rooms r ON r.room_id = t.room_id
        JOIN properties p ON p.property_id = r.property_id
        JOIN tenancy_participants tp ON tp.tenancy_id = t.tenancy_id AND tp.role = 'PRIMARY' AND tp.left_at IS NULL
        WHERE t.tenancy_id = ${tenancyId}::uuid
        FOR UPDATE OF tp
      `.execute(trx);
      const target = rows.rows[0];
      if (!target || target.user_id || !['ACTIVE', 'ENDING'].includes(target.status) ||
          target.room_state !== 'OCCUPIED') {
        throw new ConflictException('Phòng chưa có người đứng tên đủ điều kiện nhận lời mời');
      }
      await sql`
        UPDATE tenancy_join_invitations SET revoked_at = now()
        WHERE tenancy_id = ${tenancyId}::uuid AND revoked_at IS NULL AND accepted_at IS NULL
      `.execute(trx);
      const id = randomUUID();
      await sql`
        INSERT INTO tenancy_join_invitations
          (invitation_id, tenancy_id, participant_id, issued_by_user_id, token_hash, expires_at)
        VALUES (${id}::uuid, ${tenancyId}::uuid, ${target.participant_id}::uuid,
          ${operatorId}::uuid, ${hash}, ${expiresAt.toISOString()}::timestamptz)
      `.execute(trx);
      return target;
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      room: issued.room_label,
      property: issued.property_name,
    };
  }

  async preview(rawToken: string) {
    const token = this.checkedToken(rawToken);
    const result = await sql<{
      expires_at: Date;
      accepted_at: Date | null;
      revoked_at: Date | null;
      room_label: string;
      property_name: string;
      status: string;
      user_id: string | null;
      room_state: string;
    }>`
      SELECT i.expires_at, i.accepted_at, i.revoked_at,
        r.name_or_label AS room_label, p.name AS property_name,
        t.status, tp.user_id, r.operational_state AS room_state
      FROM tenancy_join_invitations i
      JOIN tenancies t ON t.tenancy_id = i.tenancy_id
      JOIN tenancy_participants tp ON tp.tenancy_participant_id = i.participant_id
      JOIN rooms r ON r.room_id = t.room_id
      JOIN properties p ON p.property_id = r.property_id
      WHERE i.token_hash = ${joinTokenHash(token)}
    `.execute(this.db);
    const row = result.rows[0];
    if (!row || row.accepted_at || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() ||
        row.user_id || !['ACTIVE', 'ENDING'].includes(row.status) || row.room_state !== 'OCCUPIED') {
      throw new NotFoundException('Mã liên kết không khả dụng hoặc đã hết hạn');
    }
    return { room: row.room_label, property: row.property_name, expiresAt: new Date(row.expires_at).toISOString() };
  }

  async accept(rawToken: string, userId: string) {
    const token = this.checkedToken(rawToken);
    if (!userId) throw new ForbiddenException('Cần đăng nhập để liên kết phòng');
    const hash = joinTokenHash(token);
    return this.db.transaction().execute(async trx => {
      const existing = await sql<InviteRow>`
        SELECT invitation_id, tenancy_id, participant_id, token_hash, expires_at, accepted_at, revoked_at
        FROM tenancy_join_invitations WHERE token_hash = ${hash}
      `.execute(trx);
      const candidate = existing.rows[0];
      if (!candidate) throw new NotFoundException('Mã liên kết không khả dụng');
      const targets = await sql<JoinTarget>`
        SELECT t.tenancy_id, t.room_id, tp.tenancy_participant_id AS participant_id,
          tp.role, tp.user_id, tp.left_at, t.status, r.operational_state AS room_state,
          r.name_or_label AS room_label, p.name AS property_name
        FROM tenancy_participants tp
        JOIN tenancies t ON t.tenancy_id = tp.tenancy_id
        JOIN rooms r ON r.room_id = t.room_id
        JOIN properties p ON p.property_id = r.property_id
        WHERE tp.tenancy_participant_id = ${candidate.participant_id}::uuid
        FOR UPDATE OF tp
      `.execute(trx);
      const target = targets.rows[0];
      const invites = await sql<InviteRow>`
        SELECT invitation_id, tenancy_id, participant_id, token_hash, expires_at, accepted_at, revoked_at
        FROM tenancy_join_invitations WHERE invitation_id = ${candidate.invitation_id}::uuid
        FOR UPDATE
      `.execute(trx);
      const invite = invites.rows[0];
      if (!target || !invite || invite.revoked_at || invite.accepted_at ||
          new Date(invite.expires_at).getTime() <= Date.now() ||
          target.user_id || target.left_at || target.role !== 'PRIMARY' ||
          invite.tenancy_id !== target.tenancy_id ||
          !['ACTIVE', 'ENDING'].includes(target.status) || target.room_state !== 'OCCUPIED') {
        throw new ConflictException('Lượt thuê không còn đủ điều kiện liên kết');
      }
      const updated = await sql`
        UPDATE tenancy_participants SET user_id = ${userId}::uuid
        WHERE tenancy_participant_id = ${target.participant_id}::uuid
          AND user_id IS NULL AND left_at IS NULL
        RETURNING tenancy_participant_id
      `.execute(trx);
      if (updated.numAffectedRows !== 1n && updated.rows.length !== 1) {
        throw new ConflictException('Người thuê đã liên kết với tài khoản khác');
      }
      await sql`
        UPDATE tenancy_join_invitations
        SET accepted_at = now(), accepted_by_user_id = ${userId}::uuid
        WHERE invitation_id = ${invite.invitation_id}::uuid
      `.execute(trx);
      return { tenancyId: target.tenancy_id, room: target.room_label, property: target.property_name };
    });
  }

  private checkedToken(value: string): string {
    const token = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!validJoinToken(token)) throw new BadRequestException('Mã liên kết không hợp lệ');
    return token;
  }
}

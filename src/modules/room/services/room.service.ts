import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { assertOwnerRoomCapacity } from './owner-capacity-policy';
import type { RoomRecord } from '../../../persistence/ports/property.repository';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../../persistence/ports/transaction-manager';
import { PropertyService } from '../../property/services/property.service';
import {
  RoomArchiveBlockers,
  RoomOperationalState,
  RoomOperationalTransitionCause,
  RoomProfile,
} from '../contracts';
import { CreateRoomDto, UpdateRoomDto } from '../dto';
const MANUAL_TRANSITIONS: Record<RoomOperationalState, RoomOperationalState[]> = {
  vacant: ['maintenance', 'inactive'],
  occupied: [],
  maintenance: ['vacant', 'inactive'],
  inactive: ['vacant'],
};
function profile(row: RoomRecord): RoomProfile {
  return {
    id: row.roomId,
    propertyId: row.propertyId,
    nameOrLabel: row.nameOrLabel,
    operationalState: row.operationalState.toLowerCase() as RoomOperationalState,
    recordLifecycle: row.recordLifecycle.toLowerCase() as RoomProfile['recordLifecycle'],
  };
}
@Injectable()
export class RoomService {
  constructor(
    @Inject(PropertyService) private readonly propertyService: PropertyService,
    @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    // Nest must inject this in production. Legacy unit harnesses construct RoomService without Nest.
    @Inject(DATABASE_CLIENT) private readonly db?: Kysely<Database>,
  ) {}

  async create(dto: CreateRoomDto): Promise<RoomProfile> {
    // Legacy in-memory domain harnesses have no PostgreSQL client. The production
    // Nest module always provides DATABASE_CLIENT and uses the quota-gated path.
    if (!this.db) return this.createForInMemoryHarness(dto);
    const roomId = dto.id ?? randomUUID();
    return this.db.transaction().execute(async (trx) => {
      const property = await sql<{ owner_id: string; lifecycle_status: string }>`
        SELECT o.primary_owner_user_id AS owner_id, p.lifecycle_status
        FROM properties p
        JOIN organizations o ON o.organization_id = p.organization_id
        WHERE p.property_id = ${dto.propertyId}
        FOR SHARE OF p, o
      `.execute(trx);
      const linked = property.rows[0];
      if (!linked) throw new NotFoundException('Property not found');
      if (linked.lifecycle_status !== 'ACTIVE') {
        throw new BadRequestException('Cannot create Room under an archived Property');
      }
      const ownerId = linked.owner_id;

      // Lock per owner, not per property. All organizations of the owner share capacity.
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${ownerId}::text, 0))`.execute(trx);

      const existing = await sql<{
        room_id: string;
        property_id: string;
        name_or_label: string;
        operational_state: string;
        record_lifecycle: string;
      }>`
        SELECT room_id, property_id, name_or_label, operational_state, record_lifecycle
        FROM rooms WHERE room_id = ${roomId}
      `.execute(trx);
      if (existing.rows[0]) {
        const current = existing.rows[0];
        if (
          current.property_id !== dto.propertyId ||
          current.name_or_label !== dto.nameOrLabel ||
          current.operational_state !== 'VACANT' ||
          current.record_lifecycle !== 'ACTIVE'
        ) {
          throw new BadRequestException(
            'Room request ID was already used with a different payload',
          );
        }
        return {
          id: current.room_id,
          propertyId: current.property_id,
          nameOrLabel: current.name_or_label,
          operationalState: 'vacant',
          recordLifecycle: 'active',
        };
      }

      const counts = await sql<{ used: number; verified_entitlements: number }>`
        SELECT
          (SELECT count(*)::integer FROM rooms r
           JOIN properties p ON p.property_id = r.property_id
           JOIN organizations o ON o.organization_id = p.organization_id
           WHERE o.primary_owner_user_id = ${ownerId}::uuid AND r.record_lifecycle = 'ACTIVE') AS used,
          (SELECT count(*)::integer FROM owner_slot_entitlements e
           WHERE e.owner_user_id = ${ownerId}::uuid
             AND e.status = 'PROVIDER_VERIFIED' AND e.valid_until > now()) AS verified_entitlements
      `.execute(trx);
      const quota = counts.rows[0];
      assertOwnerRoomCapacity(quota?.used ?? NaN, quota?.verified_entitlements ?? NaN);

      await sql`
        INSERT INTO rooms (room_id, property_id, name_or_label, operational_state, record_lifecycle)
        VALUES (${roomId}, ${dto.propertyId}, ${dto.nameOrLabel}, 'VACANT', 'ACTIVE')
        ON CONFLICT (room_id) DO NOTHING
      `.execute(trx);
      const created = await sql<{
        room_id: string;
        property_id: string;
        name_or_label: string;
        operational_state: string;
        record_lifecycle: string;
      }>`SELECT room_id, property_id, name_or_label, operational_state, record_lifecycle
         FROM rooms WHERE room_id = ${roomId}`.execute(trx);
      const saved = created.rows[0];
      if (
        !saved ||
        saved.property_id !== dto.propertyId ||
        saved.name_or_label !== dto.nameOrLabel ||
        saved.operational_state !== 'VACANT' ||
        saved.record_lifecycle !== 'ACTIVE'
      ) {
        throw new BadRequestException('Room request ID was already used with a different payload');
      }
      return {
        id: saved.room_id,
        propertyId: saved.property_id,
        nameOrLabel: saved.name_or_label,
        operationalState: 'vacant',
        recordLifecycle: 'active',
      };
    });
  }

  private async createForInMemoryHarness(dto: CreateRoomDto): Promise<RoomProfile> {
    const property = await this.propertyService.findById(dto.propertyId);
    if (property.lifecycleStatus === 'archived')
      throw new BadRequestException('Cannot create Room under an archived Property');
    if (dto.id) {
      const existing = await this.transactions.run(({ repositories }) =>
        repositories.property.findRoom(dto.id!),
      );
      if (existing) {
        if (existing.propertyId !== dto.propertyId)
          throw new BadRequestException('Room request ID already belongs to a different Property');
        if (
          existing.nameOrLabel !== dto.nameOrLabel ||
          existing.operationalState !== 'VACANT' ||
          existing.recordLifecycle !== 'ACTIVE'
        )
          throw new BadRequestException(
            'Room request ID was already used with a different payload',
          );
        return profile(existing);
      }
    }
    const value: RoomProfile = {
      id: dto.id ?? randomUUID(),
      propertyId: dto.propertyId,
      nameOrLabel: dto.nameOrLabel,
      operationalState: 'vacant',
      recordLifecycle: 'active',
    };
    await this.transactions.run(({ repositories }) =>
      repositories.property.createRoom({
        roomId: value.id,
        propertyId: value.propertyId,
        nameOrLabel: value.nameOrLabel,
        operationalState: 'VACANT',
        recordLifecycle: 'ACTIVE',
      }),
    );
    const committed = await this.transactions.run(({ repositories }) =>
      repositories.property.findRoom(value.id),
    );
    if (
      !committed ||
      committed.propertyId !== value.propertyId ||
      committed.nameOrLabel !== value.nameOrLabel ||
      committed.operationalState !== 'VACANT' ||
      committed.recordLifecycle !== 'ACTIVE'
    )
      throw new BadRequestException('Room request ID was already used with a different payload');
    return profile(committed);
  }

  async findById(id: string): Promise<RoomProfile> {
    const row = await this.transactions.run(({ repositories }) =>
      repositories.property.findRoom(id),
    );
    if (!row) throw new NotFoundException(`Không tìm thấy room với id: ${id}`);
    return profile(row);
  }
  async findByPropertyId(propertyId?: string): Promise<RoomProfile[]> {
    if (!propertyId)
      throw new BadRequestException('propertyId is required for persisted Room listing');
    return (
      await this.transactions.run(({ repositories }) =>
        repositories.property.findRoomsByProperty(propertyId),
      )
    ).map(profile);
  }
  async update(id: string, dto: UpdateRoomDto): Promise<RoomProfile> {
    return this.transactions.run(async ({ repositories }) => {
      const row = await repositories.property.findRoom(id);
      if (!row) throw new NotFoundException(`Không tìm thấy room với id: ${id}`);
      if (row.recordLifecycle === 'ARCHIVED')
        throw new BadRequestException('Archived Room cannot be edited');
      const updated = { ...row, nameOrLabel: dto.nameOrLabel ?? row.nameOrLabel };
      await repositories.property.updateRoom(updated);
      return profile(updated);
    });
  }
  async transitionOperationalState(
    id: string,
    next: RoomOperationalState,
    cause: RoomOperationalTransitionCause,
  ): Promise<RoomProfile> {
    const current = await this.findById(id);
    if (
      current.recordLifecycle === 'archived' ||
      !this.allowed(current.operationalState, next, cause)
    )
      throw new BadRequestException(
        `Invalid Room operational transition ${current.operationalState} -> ${next} with cause ${cause}`,
      );
    if (
      cause === 'manual' &&
      current.operationalState === 'inactive' &&
      next === 'vacant' &&
      (await this.propertyService.findById(current.propertyId)).lifecycleStatus === 'archived'
    )
      throw new BadRequestException(
        'Cannot reactivate inactive Room to vacant under an archived Property',
      );
    return this.transactions.run(async ({ repositories }) => {
      const row = await repositories.property.findRoom(id);
      if (!row) throw new NotFoundException(`Không tìm thấy room với id: ${id}`);
      const updated = { ...row, operationalState: next.toUpperCase() };
      await repositories.property.updateRoom(updated);
      return profile(updated);
    });
  }
  async archive(id: string, blockers: RoomArchiveBlockers): Promise<RoomProfile> {
    const current = await this.findById(id);
    if (current.recordLifecycle === 'archived')
      throw new BadRequestException('Room is already archived');
    if (current.operationalState !== 'inactive')
      throw new BadRequestException('Room archive requires operationalState=inactive');
    if (blockers.hasNonTerminalTenancy)
      throw new BadRequestException('Room archive blocked by non-terminal tenancy');
    if (blockers.hasOpenIncident)
      throw new BadRequestException('Room archive blocked by open incident');
    return this.transactions.run(async ({ repositories }) => {
      const row = await repositories.property.findRoom(id);
      if (!row) throw new NotFoundException(`Không tìm thấy room with id: ${id}`);
      const updated = { ...row, recordLifecycle: 'ARCHIVED' };
      await repositories.property.updateRoom(updated);
      return profile(updated);
    });
  }
  private allowed(
    current: RoomOperationalState,
    next: RoomOperationalState,
    cause: RoomOperationalTransitionCause,
  ): boolean {
    if (cause === 'manual') return MANUAL_TRANSITIONS[current].includes(next);
    if (cause === 'tenancy_activated') return current === 'vacant' && next === 'occupied';
    return cause === 'checkout_confirmed' && current === 'occupied' && next === 'vacant';
  }
}

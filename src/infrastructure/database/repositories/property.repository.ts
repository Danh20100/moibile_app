import type { Kysely, Transaction } from 'kysely';

import type { CreatePropertyInput, CreateRoomInput, PropertyRecord, PropertyRepository, RoomRecord } from '../../../persistence/ports/property.repository';
import { geoPoint, geographyLatitude, geographyLongitude, geographyPoint } from '../postgis';
import { mapPostgresError } from '../postgres-error.mapper';
import type { Database } from '../schema.types';

export class PostgresPropertyRepository implements PropertyRepository {
  constructor(private readonly executor: Kysely<Database> | Transaction<Database>) {}

  async createProperty(input: CreatePropertyInput): Promise<void> {
    try {
      await this.executor.insertInto('properties').values({
        property_id: input.propertyId, organization_id: input.organizationId, name: input.name,
        lifecycle_status: input.lifecycleStatus, operational_address_text: input.operationalAddressText,
        operational_location: geographyPoint(input.operationalLocation),
        public_location_projection: geographyPoint(input.publicLocationProjection),
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findProperty(propertyId: string): Promise<PropertyRecord | undefined> {
    try {
      const row = await this.executor.selectFrom('properties').select([
        'property_id', 'organization_id', 'name', 'lifecycle_status', 'operational_address_text',
        geographyLongitude('properties.operational_location').as('operational_longitude'),
        geographyLatitude('properties.operational_location').as('operational_latitude'),
        geographyLongitude('properties.public_location_projection').as('public_longitude'),
        geographyLatitude('properties.public_location_projection').as('public_latitude'),
      ]).where('property_id', '=', propertyId).executeTakeFirst();
      return row ? {
        propertyId: row.property_id, organizationId: row.organization_id, name: row.name,
        lifecycleStatus: row.lifecycle_status, operationalAddressText: row.operational_address_text,
        operationalLocation: geoPoint(row.operational_longitude, row.operational_latitude),
        publicLocationProjection: geoPoint(row.public_longitude, row.public_latitude),
      } : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findPropertiesByOrganization(organizationId?: string): Promise<PropertyRecord[]> {
    try {
      let query = this.executor.selectFrom('properties').select([
        'property_id', 'organization_id', 'name', 'lifecycle_status', 'operational_address_text',
        geographyLongitude('properties.operational_location').as('operational_longitude'),
        geographyLatitude('properties.operational_location').as('operational_latitude'),
        geographyLongitude('properties.public_location_projection').as('public_longitude'),
        geographyLatitude('properties.public_location_projection').as('public_latitude'),
      ]);
      if (organizationId) query = query.where('organization_id', '=', organizationId);
      const rows = await query.orderBy('property_id').execute();
      return rows.map((row) => ({
        propertyId: row.property_id, organizationId: row.organization_id, name: row.name,
        lifecycleStatus: row.lifecycle_status, operationalAddressText: row.operational_address_text,
        operationalLocation: geoPoint(row.operational_longitude, row.operational_latitude),
        publicLocationProjection: geoPoint(row.public_longitude, row.public_latitude),
      }));
    } catch (error) { throw mapPostgresError(error); }
  }

  async updateProperty(record: PropertyRecord): Promise<void> {
    try {
      await this.executor.updateTable('properties').set({
        organization_id: record.organizationId, name: record.name, lifecycle_status: record.lifecycleStatus,
        operational_address_text: record.operationalAddressText,
        operational_location: geographyPoint(record.operationalLocation),
        public_location_projection: geographyPoint(record.publicLocationProjection),
      }).where('property_id', '=', record.propertyId).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async createRoom(input: CreateRoomInput): Promise<void> {
    try {
      await this.executor.insertInto('rooms').values({
        room_id: input.roomId, property_id: input.propertyId, name_or_label: input.nameOrLabel,
        operational_state: input.operationalState, record_lifecycle: input.recordLifecycle,
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findRoom(roomId: string): Promise<RoomRecord | undefined> {
    try {
      const row = await this.executor.selectFrom('rooms')
        .select(['room_id', 'property_id', 'name_or_label', 'operational_state', 'record_lifecycle'])
        .where('room_id', '=', roomId).executeTakeFirst();
      return row ? this.mapRoom(row) : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async findRoomsByProperty(propertyId: string): Promise<RoomRecord[]> {
    try {
      const rows = await this.executor.selectFrom('rooms')
        .select(['room_id', 'property_id', 'name_or_label', 'operational_state', 'record_lifecycle'])
        .where('property_id', '=', propertyId).orderBy('room_id').execute();
      return rows.map((row) => this.mapRoom(row));
    } catch (error) { throw mapPostgresError(error); }
  }

  async updateRoom(record: RoomRecord): Promise<void> {
    try {
      await this.executor.updateTable('rooms').set({
        property_id: record.propertyId, name_or_label: record.nameOrLabel,
        operational_state: record.operationalState, record_lifecycle: record.recordLifecycle,
      }).where('room_id', '=', record.roomId).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async lockProperty(propertyId: string): Promise<void> {
    try { await this.executor.selectFrom('properties').select('property_id').where('property_id', '=', propertyId).forUpdate().executeTakeFirst(); }
    catch (error) { throw mapPostgresError(error); }
  }

  async lockRoom(roomId: string): Promise<void> {
    try { await this.executor.selectFrom('rooms').select('room_id').where('room_id', '=', roomId).forUpdate().executeTakeFirst(); }
    catch (error) { throw mapPostgresError(error); }
  }

  private mapRoom(row: { room_id: string; property_id: string; name_or_label: string; operational_state: string; record_lifecycle: string }): RoomRecord {
    return { roomId: row.room_id, propertyId: row.property_id, nameOrLabel: row.name_or_label, operationalState: row.operational_state, recordLifecycle: row.record_lifecycle };
  }
}

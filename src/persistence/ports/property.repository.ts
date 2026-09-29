import type { GeoPoint } from './geography';

export interface PropertyRecord {
  propertyId: string; organizationId: string; name: string; lifecycleStatus: string;
  operationalAddressText: string; operationalLocation: GeoPoint; publicLocationProjection: GeoPoint;
}
export interface RoomRecord {
  roomId: string; propertyId: string; nameOrLabel: string; operationalState: string; recordLifecycle: string;
}
export type CreatePropertyInput = PropertyRecord;
export type CreateRoomInput = RoomRecord;
export interface PropertyRepository {
  createProperty(input: CreatePropertyInput): Promise<void>;
  findProperty(propertyId: string): Promise<PropertyRecord | undefined>;
  findPropertiesByOrganization(organizationId?: string): Promise<PropertyRecord[]>;
  updateProperty(record: PropertyRecord): Promise<void>;
  createRoom(input: CreateRoomInput): Promise<void>;
  findRoom(roomId: string): Promise<RoomRecord | undefined>;
  findRoomsByProperty(propertyId: string): Promise<RoomRecord[]>;
  updateRoom(record: RoomRecord): Promise<void>;
  lockProperty(propertyId: string): Promise<void>;
  lockRoom(roomId: string): Promise<void>;
}

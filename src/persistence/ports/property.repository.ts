import type { GeoPoint } from './geography';

export interface PropertyRecord {
  property_id: string; organization_id: string; name: string; lifecycle_status: string;
  operational_address_text: string; operational_location: GeoPoint; public_location_projection: GeoPoint;
}
export interface RoomRecord {
  room_id: string; property_id: string; name_or_label: string; operational_state: string; record_lifecycle: string;
}
export interface CreatePropertyInput extends PropertyRecord {}
export interface CreateRoomInput extends RoomRecord {}
export interface PropertyRepository {
  createProperty(input: CreatePropertyInput): Promise<void>;
  findProperty(propertyId: string): Promise<PropertyRecord | undefined>;
  updateProperty(record: PropertyRecord): Promise<void>;
  createRoom(input: CreateRoomInput): Promise<void>;
  findRoom(roomId: string): Promise<RoomRecord | undefined>;
  findRoomsByProperty(propertyId: string): Promise<RoomRecord[]>;
  updateRoom(record: RoomRecord): Promise<void>;
  lockProperty(propertyId: string): Promise<void>;
  lockRoom(roomId: string): Promise<void>;
}

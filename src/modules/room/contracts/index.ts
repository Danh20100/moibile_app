export type RoomStatus = 'draft' | 'vacant' | 'occupied' | 'maintenance' | 'archived';

export interface RoomReference {
  roomId: string;
}

export interface RoomProfile {
  id: string;
  propertyId: string;
  roomNumber: string;
  basePrice: number;
  area?: number;
  maxOccupants?: number;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

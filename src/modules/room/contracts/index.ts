export type RoomOperationalState = 'vacant' | 'occupied' | 'maintenance' | 'inactive';

export type RoomRecordLifecycle = 'active' | 'archived';

export type RoomOperationalTransitionCause =
  | 'manual'
  | 'tenancy_activated'
  | 'checkout_confirmed';

export interface RoomReference {
  roomId: string;
}

export interface RoomProfile {
  id: string;
  propertyId: string;
  nameOrLabel: string;
  operationalState: RoomOperationalState;
  recordLifecycle: RoomRecordLifecycle;
  createdAt: string;
  updatedAt: string;
}

export interface RoomArchiveBlockers {
  hasNonTerminalTenancy: boolean;
  hasOpenIncident: boolean;
}

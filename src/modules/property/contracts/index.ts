export type PropertyLifecycle = 'active' | 'archived';

export interface PropertyReference {
  propertyId: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PropertyProfile {
  id: string;
  organizationId: string;
  name: string;
  lifecycleStatus: PropertyLifecycle;
  operationalAddressText: string;
  operationalLocation: GeoPoint;
  publicLocationProjection: GeoPoint;
}

export interface PropertyArchiveBlockers {
  hasNonTerminalTenancy: boolean;
  hasPublishedListing: boolean;
  hasOccupiedRoom: boolean;
  hasNonInactiveOrArchivedRoom: boolean;
  hasOpenIncident: boolean;
}

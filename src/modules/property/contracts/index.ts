export type PropertyStatus = 'active' | 'archived';

export interface PropertyReference {
  propertyId: string;
}

export interface PropertyLocation {
  address: string;
  ward?: string;
  district?: string;
  city?: string;
}

export interface PropertyProfile {
  id: string;
  organizationId: string;
  name: string;
  location: PropertyLocation;
  status: PropertyStatus;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationStatus = 'active' | 'inactive' | 'archived';

export interface OrganizationReference {
  organizationId: string;
}

export interface OrganizationProfile {
  id: string;
  name: string;
  description?: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

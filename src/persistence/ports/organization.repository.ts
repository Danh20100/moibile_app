export interface OrganizationRecord { organizationId: string; primaryOwnerUserId: string; name: string }
export interface CreateOrganizationInput extends OrganizationRecord {}
export interface OrganizationRepository {
  createOrganization(input: CreateOrganizationInput): Promise<void>;
  findOrganization(organizationId: string): Promise<OrganizationRecord | undefined>;
  findOrganizations(): Promise<OrganizationRecord[]>;
  updateOrganization(record: OrganizationRecord): Promise<void>;
  lockOrganization(organizationId: string): Promise<void>;
}

export interface OrganizationRecord { organization_id: string; primary_owner_user_id: string; name: string }
export interface CreateOrganizationInput extends OrganizationRecord {}
export interface OrganizationRepository {
  createOrganization(input: CreateOrganizationInput): Promise<void>;
  findOrganization(organizationId: string): Promise<OrganizationRecord | undefined>;
  updateOrganization(record: OrganizationRecord): Promise<void>;
  lockOrganization(organizationId: string): Promise<void>;
}

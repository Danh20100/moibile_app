import type { OrganizationRecord } from '../../../src/persistence/ports/organization.repository';
import type { PropertyRecord, RoomRecord } from '../../../src/persistence/ports/property.repository';
import type { TransactionManager } from '../../../src/persistence/ports/transaction-manager';

export function createCoreTestTransactionManager(): TransactionManager {
  const users = new Set<string>();
  const organizations = new Map<string, OrganizationRecord>();
  const properties = new Map<string, PropertyRecord>();
  const rooms = new Map<string, RoomRecord>();
  const repositories = {
    identity: { ensureUser: async (id: string) => { users.add(id); }, userExists: async (id: string) => users.has(id) },
    organization: {
      createOrganization: async (value: OrganizationRecord) => { organizations.set(value.organizationId, structuredClone(value)); },
      findOrganization: async (id: string) => structuredClone(organizations.get(id)),
      findOrganizations: async () => Array.from(organizations.values()).map((value) => structuredClone(value)),
      updateOrganization: async (value: OrganizationRecord) => { organizations.set(value.organizationId, structuredClone(value)); },
      lockOrganization: async () => undefined,
    },
    property: {
      createProperty: async (value: PropertyRecord) => { properties.set(value.propertyId, structuredClone(value)); },
      findProperty: async (id: string) => structuredClone(properties.get(id)),
      findPropertiesByOrganization: async (id?: string) => Array.from(properties.values()).filter((value) => !id || value.organizationId === id).map((value) => structuredClone(value)),
      updateProperty: async (value: PropertyRecord) => { properties.set(value.propertyId, structuredClone(value)); },
      createRoom: async (value: RoomRecord) => { rooms.set(value.roomId, structuredClone(value)); },
      findRoom: async (id: string) => structuredClone(rooms.get(id)),
      findRoomsByProperty: async (id: string) => Array.from(rooms.values()).filter((value) => value.propertyId === id).map((value) => structuredClone(value)),
      updateRoom: async (value: RoomRecord) => { rooms.set(value.roomId, structuredClone(value)); },
      lockProperty: async () => undefined,
      lockRoom: async () => undefined,
    },
  };
  return { run: async (work) => work({ repositories: repositories as never, afterCommit: () => undefined }) };
}

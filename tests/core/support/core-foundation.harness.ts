import { OrganizationService } from '../../../src/modules/organization/services/organization.service';
import { PropertyService } from '../../../src/modules/property/services/property.service';
import { RoomService } from '../../../src/modules/room/services/room.service';
import { createCoreTestTransactionManager } from './in-memory-transaction-manager';

export interface CoreFoundationHarness {
  organizationService: OrganizationService;
  propertyService: PropertyService;
  roomService: RoomService;
}

export function createCoreFoundationHarness(): CoreFoundationHarness {
  const transactions = createCoreTestTransactionManager();
  const organizationService = new OrganizationService(transactions);
  const propertyService = new PropertyService(organizationService, transactions);
  const roomService = new RoomService(propertyService, transactions);
  return { organizationService, propertyService, roomService };
}

export async function createOrganization(harness: CoreFoundationHarness): Promise<string> {
  const organization = await harness.organizationService.create({
    name: 'Workspace A',
    primaryOwnerUserId: 'user_owner',
  });
  return organization.id;
}

export async function createActiveProperty(
  harness: CoreFoundationHarness,
  organizationId?: string,
): Promise<string> {
  const property = await harness.propertyService.create({
    organizationId: organizationId ?? (await createOrganization(harness)),
    name: 'Property A',
    operationalAddressText: 'Address A',
    operationalLocation: { latitude: 21.0, longitude: 105.0 },
    publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
  });
  return property.id;
}

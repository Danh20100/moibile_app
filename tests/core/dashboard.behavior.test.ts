import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException } from '@nestjs/common';

import { ResourceAuthorizationService } from '../../src/common';
import { DashboardController } from '../../src/modules/dashboard/controllers/dashboard.controller';
import { DashboardService } from '../../src/modules/dashboard/services/dashboard.service';
import type { VerifiedPrincipal } from '../../src/modules/identity-access/contracts';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const ownerId = '10000000-0000-4000-8000-000000000001';
const strangerId = '10000000-0000-4000-8000-000000000002';
const organizationId = '20000000-0000-4000-8000-000000000001';
const activePropertyId = '30000000-0000-4000-8000-000000000001';
const archivedPropertyId = '30000000-0000-4000-8000-000000000002';
const vacantRoomId = '40000000-0000-4000-8000-000000000001';
const occupiedRoomId = '40000000-0000-4000-8000-000000000002';
const archivedRoomId = '40000000-0000-4000-8000-000000000003';

function principal(userId: string): VerifiedPrincipal {
  return {
    userId,
    provider: 'google',
    issuer: 'https://accounts.google.com',
    subject: userId,
  };
}

test('Dashboard is organization-scoped and derives only frozen current operational counts', async () => {
  const tx = createCoreTestTransactionManager();
  await tx.run(async ({ repositories }) => {
    await repositories.organization.createOrganization({
      organizationId,
      primaryOwnerUserId: ownerId,
      name: 'Dashboard Org',
    });
    await repositories.property.createProperty({
      propertyId: activePropertyId,
      organizationId,
      name: 'Active Property',
      lifecycleStatus: 'ACTIVE',
      operationalAddressText: 'private',
      operationalLocation: { latitude: 10.8, longitude: 106.7 },
      publicLocationProjection: { latitude: 10.81, longitude: 106.71 },
    });
    await repositories.property.createProperty({
      propertyId: archivedPropertyId,
      organizationId,
      name: 'Archived Property',
      lifecycleStatus: 'ARCHIVED',
      operationalAddressText: 'private archived',
      operationalLocation: { latitude: 10.82, longitude: 106.72 },
      publicLocationProjection: { latitude: 10.83, longitude: 106.73 },
    });
    await repositories.property.createRoom({
      roomId: vacantRoomId,
      propertyId: activePropertyId,
      nameOrLabel: 'A-01',
      operationalState: 'VACANT',
      recordLifecycle: 'ACTIVE',
    });
    await repositories.property.createRoom({
      roomId: occupiedRoomId,
      propertyId: activePropertyId,
      nameOrLabel: 'A-02',
      operationalState: 'OCCUPIED',
      recordLifecycle: 'ACTIVE',
    });
    await repositories.property.createRoom({
      roomId: archivedRoomId,
      propertyId: archivedPropertyId,
      nameOrLabel: 'OLD-01',
      operationalState: 'INACTIVE',
      recordLifecycle: 'ARCHIVED',
    });
    await repositories.tenancy.createTenancy({
      tenancyId: '60000000-0000-4000-8000-000000000001',
      roomId: occupiedRoomId,
      status: 'ACTIVE',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: null,
      endReason: null,
    });
    await repositories.tenancy.createTenancy({
      tenancyId: '60000000-0000-4000-8000-000000000002',
      roomId: vacantRoomId,
      status: 'ENDED',
      startedAt: '2025-01-01T00:00:00.000Z',
      endedAt: '2025-12-01T00:00:00.000Z',
      endReason: 'MOVE_OUT_CONFIRMED',
    });
    await repositories.incident.createIncident({
      incidentId: '80000000-0000-4000-8000-000000000001',
      roomId: occupiedRoomId,
      reportedByUserId: null,
      category: 'PLUMBING',
      status: 'RESOLVED',
      closureReason: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      closedAt: null,
    });
    await repositories.incident.createIncident({
      incidentId: '80000000-0000-4000-8000-000000000002',
      roomId: occupiedRoomId,
      reportedByUserId: null,
      category: 'ELECTRICAL',
      status: 'CLOSED',
      closureReason: 'NO_ACTION_REQUIRED',
      createdAt: '2026-08-01T00:00:00.000Z',
      closedAt: '2026-08-02T00:00:00.000Z',
    });
  });

  const service = new DashboardService(tx);
  const controller = new DashboardController(service, new ResourceAuthorizationService(tx));

  const projection = await controller.findByOrganization(organizationId, principal(ownerId));
  assert.deepEqual(projection.roomsByState, {
    VACANT: 1,
    OCCUPIED: 1,
    MAINTENANCE: 0,
    INACTIVE: 0,
  });
  assert.equal(projection.activeTenancyCount, 1);
  assert.equal(projection.openIncidentCount, 1);
  assert.equal(projection.outstandingReceivable, null);
  assert.equal(projection.confirmedPaymentTotal, null);

  await assert.rejects(
    () => controller.findByOrganization(organizationId, principal(strangerId)),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

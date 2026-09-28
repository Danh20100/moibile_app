import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import type { GoogleIdTokenVerifier } from '../../../src/integrations/google-identity';
import { AuditTrustService } from '../../../src/modules/audit-trust/services/audit-trust.service';
import { BillingService } from '../../../src/modules/billing/services/billing.service';
import { IdentityAccessService } from '../../../src/modules/identity-access/services/identity-access.service';
import { OnboardingService } from '../../../src/modules/onboarding/services/onboarding.service';
import { OrganizationService } from '../../../src/modules/organization/services/organization.service';
import { PropertyService } from '../../../src/modules/property/services/property.service';
import { RoomService } from '../../../src/modules/room/services/room.service';
import { SubscriptionService } from '../../../src/modules/subscription/services/subscription.service';

function injectVerifier(service: IdentityAccessService, verifier: GoogleIdTokenVerifier): void {
  Object.defineProperty(service, 'verifier', {
    configurable: true,
    writable: true,
    value: verifier,
  });
}

describe('architecture contract audit', () => {
  it('does not infer a default business role during authentication', async () => {
    const service = new IdentityAccessService();
    injectVerifier(service, {
      async verify() {
        return { subject: 'google-subject-1', email: 'user@example.com' };
      },
    });

    const result = await service.authenticateWithGoogle({ idToken: 'valid-token' });

    assert.equal(
      'role' in result,
      false,
      'Authentication should accept identity before role/profile enrichment; it must not infer tenant role.',
    );
  });

  it('does not allow callers to mutate room state outside the lifecycle boundary', async () => {
    const service = new RoomService();
    const created = await service.create({
      propertyId: 'prop_1',
      nameOrLabel: '101',
    });

    created.operationalState = 'occupied';
    const reread = await service.findById(created.id);

    assert.equal(
      reread.operationalState,
      'vacant',
      'A returned object must not be a mutable alias to the module-owned state.',
    );
  });

  it('keeps audit history immutable when caller-owned metadata changes', async () => {
    const service = new AuditTrustService();
    const metadata: Record<string, unknown> = { reason: 'original' };

    const record = await service.recordFact({
      actorId: 'actor_1',
      action: 'room.created',
      resourceType: 'room',
      resourceId: 'room_1',
      metadata,
    });

    metadata.reason = 'tampered-after-recording';
    const [stored] = await service.queryAudit({ resourceId: record.resourceId });

    assert.equal(
      stored?.metadata?.reason,
      'original',
      'Audit history must snapshot facts instead of retaining mutable caller references.',
    );
  });

  it('does not share mutable plan capability arrays across organizations', async () => {
    const service = new SubscriptionService();
    const first = await service.assignPlan({
      organizationId: 'org_1',
      plan: 'free',
      durationDays: 30,
    });

    first.capabilities.push('api_access');

    const second = await service.assignPlan({
      organizationId: 'org_2',
      plan: 'free',
      durationDays: 30,
    });
    assert.equal(
      second.capabilities.includes('api_access'),
      false,
      'Mutating one subscription must not change the capability template used by another organization.',
    );
  });

  it('rejects a payment outcome that exceeds the outstanding billing balance', async () => {
    const service = new BillingService();
    const cycle = await service.createCycle({
      tenancyId: 'ten_1',
      roomId: 'room_1',
      cycleMonth: '2099-01',
      dueDate: '2099-01-31',
      charges: [{ type: 'rent', description: 'Monthly rent', amount: 1_000_000 }],
    });

    await assert.rejects(
      service.applyPaymentOutcome(cycle.id, {
        amountPaid: 1_500_000,
        receiptId: 'rcpt_overpay',
      }),
      BadRequestException,
      'Overpayment must be rejected instead of producing paidAmount greater than totalAmount.',
    );
  });

  it('creates actual destination-domain data when onboarding is confirmed', async () => {
    const organizations = new OrganizationService();
    const properties = new PropertyService(organizations);
    const rooms = new RoomService(properties);
    const onboarding = new OnboardingService(properties, rooms);
    const organization = await organizations.create({
      name: 'Organization A',
      primaryOwnerUserId: 'user_owner_a',
    });

    const batch = await onboarding.validateAndPreview({
      organizationId: organization.id,
      propertyName: 'Property A',
      propertyAddress: 'Address A',
      rooms: [{ roomNumber: '101', basePrice: 3_000_000 }],
    });
    const confirmed = await onboarding.confirmBatch({ batchId: batch.id });

    assert.ok(confirmed.createdPropertyId);
    await assert.doesNotReject(properties.findById(confirmed.createdPropertyId));
    assert.equal((await rooms.findByPropertyId(confirmed.createdPropertyId)).length, 1);
  });

  it('keeps an audit record immutable even if the returned record is modified', async () => {
    const service = new AuditTrustService();
    const record = await service.recordFact({
      actorId: 'actor_1',
      action: 'tenancy.ended',
      resourceType: 'tenancy',
      resourceId: 'ten_1',
    });

    record.action = 'tampered.action';
    const [stored] = await service.queryAudit({ resourceId: 'ten_1' });

    assert.equal(
      stored?.action,
      'tenancy.ended',
      'Audit records must not be mutable through objects returned to callers.',
    );
  });

  it('does not silently create fake destination data for a confirmed onboarding batch', async () => {
    const organizations = new OrganizationService();
    const properties = new PropertyService(organizations);
    const rooms = new RoomService(properties);
    const onboarding = new OnboardingService(properties, rooms);
    const organization = await organizations.create({
      name: 'Organization B',
      primaryOwnerUserId: 'user_owner_b',
    });
    const batch = await onboarding.validateAndPreview({
      organizationId: organization.id,
      propertyName: 'Property B',
      propertyAddress: 'Address B',
      rooms: [{ roomNumber: '101', basePrice: 3_000_000 }],
    });
    const confirmed = await onboarding.confirmBatch({ batchId: batch.id });

    assert.ok(confirmed.createdPropertyId);
    assert.equal(confirmed.createdPropertyId.startsWith('prop_onboard_'), false);
  });

  it('requires destination services before onboarding confirmation can create domain data', async () => {
    const onboarding = new OnboardingService();
    const batch = await onboarding.validateAndPreview({
      organizationId: 'org_reference',
      propertyName: 'Property C',
      propertyAddress: 'Address C',
      rooms: [{ roomNumber: '101', basePrice: 3_000_000 }],
    });

    await assert.rejects(
      onboarding.confirmBatch({ batchId: batch.id }),
      InternalServerErrorException,
      'Confirmation must not instantiate destination services as an internal fallback.',
    );
  });

  it('keeps independent property and room service instances isolated', async () => {
    const propertiesA = new PropertyService();
    const propertiesB = new PropertyService();
    const createdProperty = await propertiesA.create({
      organizationId: 'org_reference',
      name: 'Isolated Property',
      operationalAddressText: 'Address',
      operationalLocation: { latitude: 21.0, longitude: 105.0 },
      publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
    });
    await assert.rejects(propertiesB.findById(createdProperty.id), NotFoundException);

    const roomsA = new RoomService();
    const roomsB = new RoomService();
    const createdRoom = await roomsA.create({
      propertyId: 'prop_reference',
      nameOrLabel: 'A-101',
    });
    await assert.rejects(roomsB.findById(createdRoom.id), NotFoundException);
  });

  it('still reports missing resources with the expected Nest exception type', async () => {
    const service = new PropertyService();
    await assert.rejects(service.findById('missing'), NotFoundException);
  });
});

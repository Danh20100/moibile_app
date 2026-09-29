import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { BillingService } from '../../../src/modules/billing/services/billing.service';
import { IncidentService } from '../../../src/modules/incident/services/incident.service';
import { ListingService } from '../../../src/modules/listing/services/listing.service';
import { OnboardingService } from '../../../src/modules/onboarding/services/onboarding.service';
import { ReceiptService } from '../../../src/modules/receipt/services/receipt.service';
import { SubscriptionService } from '../../../src/modules/subscription/services/subscription.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import { createActiveProperty, createCoreFoundationHarness } from '../../core/support/core-foundation.harness';

describe('low-level architecture baseline behavior', () => {
  it('enforces the room operational-state machine', async () => {
    const harness = createCoreFoundationHarness();
    const service = harness.roomService;
    const room = await service.create({
      propertyId: await createActiveProperty(harness),
      nameOrLabel: '101',
    });

    assert.equal(room.operationalState, 'vacant');
    assert.equal(room.recordLifecycle, 'active');
    assert.equal(
      (await service.transitionOperationalState(room.id, 'maintenance', 'manual')).operationalState,
      'maintenance',
    );
    assert.equal(
      (await service.transitionOperationalState(room.id, 'vacant', 'manual')).operationalState,
      'vacant',
    );
    assert.equal(
      (await service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated'))
        .operationalState,
      'occupied',
    );
    await assert.rejects(
      service.transitionOperationalState(room.id, 'maintenance', 'manual'),
      BadRequestException,
    );
  });

  it('enforces the tenancy lifecycle state machine', async () => {
    const service = new TenancyService(createCoreFoundationHarness().transactions);
    const tenancy = await service.createDraft('room_1');

    assert.equal(tenancy.status, 'draft');
    assert.equal(
      (await service.activateLocal(tenancy.id, '2026-10-01T00:00:00.000Z')).status,
      'active',
    );
    assert.equal((await service.startEnding(tenancy.id)).status, 'ending');
    assert.equal(
      (await service.completeCheckoutLocal(tenancy.id, 'MUTUAL', '2026-11-01T00:00:00.000Z')).status,
      'ended',
    );
    await assert.rejects(service.resumeActive(tenancy.id), BadRequestException);
  });

  it('enforces the incident lifecycle state machine', async () => {
    const service = new IncidentService({ findById: async () => ({ id: 'room_1' }) } as never);
    const incident = await service.create({
      roomId: 'room_1',
      reportedByUserId: 'tenant_1',
      category: 'PLUMBING',
    });

    assert.equal(incident.status, 'REPORTED');
    assert.equal(
      (await service.updateStatus(incident.id, { status: 'ACKNOWLEDGED' })).status,
      'ACKNOWLEDGED',
    );
    assert.equal(
      (await service.updateStatus(incident.id, { status: 'IN_PROGRESS' })).status,
      'IN_PROGRESS',
    );
    assert.equal(
      (await service.updateStatus(incident.id, { status: 'RESOLVED', note: 'Fixed' })).status,
      'RESOLVED',
    );
    assert.equal((await service.updateStatus(incident.id, { status: 'CLOSED' })).status, 'CLOSED');
  });

  it('exposes public listings only while their state is published', async () => {
    const service = new ListingService(createCoreFoundationHarness().transactions);
    const listing = await service.createDraft({
      roomId: 'room_1',
      publicTitle: 'Room 101',
      publicDescription: 'Public room description',
      publicPriceProjection: '3500000.00',
      publicLocationProjection: { latitude: 10.77, longitude: 106.69 },
    });

    assert.deepEqual(await service.findPublished(), []);
    const transition = {
      reasonCode: 'LANDLORD_MANUAL',
      actorType: 'USER',
      trigger: 'COMMAND',
    };
    await service.transition(listing.id, 'published', transition);
    assert.equal((await service.findPublished()).length, 1);
    await service.transition(listing.id, 'unpublished', transition);
    assert.deepEqual(await service.findPublished(), []);
  });

  it('keeps confirmed Payment separate from Billing Cycle obligation', async () => {
    const service = new BillingService({ findById: async () => ({ id: 'ten_1' }) } as never);
    const cycle = await service.createCycle({ tenancyId: 'ten_1', tenancyTermsId: 'terms_1', periodStart: '2099-01-01', periodEnd: '2099-01-31', charges: [{ type: 'RENT', amount: '3500000.00' }] });
    const payment = await service.recordPayment({ tenancyId: 'ten_1', amount: '3500000.00', source: 'MANUAL_TRANSFER', verification: 'USER_RECORDED', confirmedAt: new Date().toISOString() });
    const allocation = await service.allocatePayment(payment.id, cycle.charges[0]!.id, '3500000.00');
    assert.equal(allocation.paymentId, payment.id);
    assert.equal('paidAmount' in cycle, false);
  });

  it('allows only one current issued Receipt per Payment', async () => {
    const finance = new BillingService({ findById: async () => ({ id: 'ten_1' }) } as never);
    const payment = await finance.recordPayment({ tenancyId: 'ten_1', amount: '1.00', source: 'MANUAL_CASH', verification: 'USER_RECORDED', confirmedAt: new Date().toISOString() });
    const service = new ReceiptService(finance);
    await service.issue(payment.id);
    await assert.rejects(() => service.issue(payment.id), BadRequestException);
  });

  it('rejects duplicate room numbers in an onboarding batch', async () => {
    const service = new OnboardingService();

    await assert.rejects(
      service.validateAndPreview({
        organizationId: 'org_1',
        propertyName: 'Property A',
        propertyAddress: 'Address A',
        rooms: [
          { roomNumber: '101', basePrice: 3_000_000 },
          { roomNumber: '101', basePrice: 3_500_000 },
        ],
      }),
      BadRequestException,
    );
  });

  it('returns entitlement decisions by capability', async () => {
    const service = new SubscriptionService();
    await service.assignPlan({ organizationId: 'org_1', plan: 'starter', durationDays: 30 });

    assert.deepEqual(await service.checkEntitlement('org_1', 'bulk_onboarding'), {
      allowed: true,
      reason: undefined,
    });
    assert.equal((await service.checkEntitlement('org_1', 'api_access')).allowed, false);
  });
});

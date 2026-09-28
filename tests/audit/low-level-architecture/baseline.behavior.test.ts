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
    const service = new TenancyService();
    const tenancy = await service.create({
      roomId: 'room_1',
      tenantId: 'tenant_1',
      monthlyRent: 3_500_000,
      depositAmount: 3_500_000,
      paymentDueDay: 5,
      startDate: '2026-10-01',
    });

    assert.equal(tenancy.status, 'draft');
    assert.equal((await service.updateStatus(tenancy.id, { status: 'active' })).status, 'active');
    assert.equal((await service.updateStatus(tenancy.id, { status: 'ending' })).status, 'ending');
    assert.equal((await service.updateStatus(tenancy.id, { status: 'ended' })).status, 'ended');

    await assert.rejects(
      service.updateStatus(tenancy.id, { status: 'active' }),
      BadRequestException,
    );
  });

  it('enforces the incident lifecycle state machine', async () => {
    const service = new IncidentService();
    const incident = await service.create({
      roomId: 'room_1',
      reporterId: 'tenant_1',
      title: 'Water leak',
      description: 'Water is leaking under the sink',
      category: 'plumbing',
    });

    assert.equal(incident.status, 'reported');
    assert.equal(
      (await service.updateStatus(incident.id, { status: 'acknowledged' })).status,
      'acknowledged',
    );
    assert.equal(
      (await service.updateStatus(incident.id, { status: 'processing' })).status,
      'processing',
    );
    assert.equal(
      (await service.updateStatus(incident.id, { status: 'need_more_information' })).status,
      'need_more_information',
    );
    assert.equal(
      (await service.updateStatus(incident.id, { status: 'processing' })).status,
      'processing',
    );
    assert.equal(
      (await service.updateStatus(incident.id, { status: 'resolved', note: 'Fixed' })).status,
      'resolved',
    );
    assert.equal((await service.updateStatus(incident.id, { status: 'closed' })).status, 'closed');
  });

  it('exposes public listings only while their state is published', async () => {
    const service = new ListingService();
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

  it('reconciles an exact billing payment from upcoming to paid', async () => {
    const service = new BillingService();
    const cycle = await service.createCycle({
      tenancyId: 'ten_1',
      roomId: 'room_1',
      cycleMonth: '2099-01',
      dueDate: '2099-01-31',
      charges: [
        { type: 'rent', description: 'Monthly rent', amount: 3_500_000 },
        { type: 'water', description: 'Water', amount: 100_000 },
      ],
    });

    assert.equal(cycle.totalAmount, 3_600_000);
    assert.equal(cycle.outstandingBalance, 3_600_000);
    assert.equal(cycle.status, 'upcoming');

    const partial = await service.applyPaymentOutcome(cycle.id, {
      amountPaid: 1_000_000,
      receiptId: 'rcpt_1',
    });
    assert.equal(partial.status, 'partial');
    assert.equal(partial.outstandingBalance, 2_600_000);

    const paid = await service.applyPaymentOutcome(cycle.id, {
      amountPaid: 2_600_000,
      receiptId: 'rcpt_2',
    });
    assert.equal(paid.status, 'paid');
    assert.equal(paid.outstandingBalance, 0);
    assert.equal(paid.paidAmount, paid.totalAmount);
  });

  it('allows a receipt to be confirmed exactly once', async () => {
    const service = new ReceiptService();
    const receipt = await service.create({
      billingCycleId: 'bill_1',
      tenancyId: 'ten_1',
      amount: 3_500_000,
      paymentMethod: 'bank_transfer',
      paidAt: '2026-10-04T10:30:00.000Z',
    });

    const confirmed = await service.confirm(receipt.id, { confirmedBy: 'operator_1' });
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(confirmed.confirmedBy, 'operator_1');

    await assert.rejects(
      service.confirm(receipt.id, { confirmedBy: 'operator_2' }),
      BadRequestException,
    );
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

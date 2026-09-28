import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../../src/app.module';
import { BillingService } from '../../../src/modules/billing/services/billing.service';
import { IncidentService } from '../../../src/modules/incident/services/incident.service';
import { ListingService } from '../../../src/modules/listing/services/listing.service';
import { PropertyService } from '../../../src/modules/property/services/property.service';
import { ReceiptService } from '../../../src/modules/receipt/services/receipt.service';
import { RoomService } from '../../../src/modules/room/services/room.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
async function expectRejection(action: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, message);
}

describe('cross-module reference integrity audit', () => {
  let app: INestApplicationContext;

  before(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  });

  after(async () => {
    await app.close();
  });

  it('rejects a property that references a nonexistent organization', async () => {
    const service = app.get(PropertyService);
    await expectRejection(
      async () =>
        service.create({
          organizationId: 'org_missing',
          name: 'Property',
          operationalAddressText: 'Address',
          operationalLocation: { latitude: 21.0, longitude: 105.0 },
          publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
        }),
      'Property must validate its organization scope before accepting the reference.',
    );
  });

  it('rejects a room that references a nonexistent property', async () => {
    const service = app.get(RoomService);
    await expectRejection(
      async () =>
        service.create({ propertyId: 'prop_missing', nameOrLabel: 'A-101' }),
      'Room must validate its property reference.',
    );
  });

  it('rejects a tenancy that references a nonexistent room', async () => {
    const service = app.get(TenancyService);
    await expectRejection(
      async () =>
        service.create({
          roomId: 'room_missing',
          tenantId: 'tenant_reference',
          monthlyRent: 3000000,
          depositAmount: 3000000,
          paymentDueDay: 5,
          startDate: '2026-10-01',
        }),
      'Tenancy must validate its room reference.',
    );
  });

  it('rejects a billing cycle with nonexistent tenancy/room context', async () => {
    const service = app.get(BillingService);
    await expectRejection(
      async () =>
        service.createCycle({
          tenancyId: 'ten_missing',
          roomId: 'room_missing',
          cycleMonth: '2026-10',
          dueDate: '2026-10-05',
          charges: [{ type: 'rent', description: 'Rent', amount: 3000000 }],
        }),
      'Billing must validate authoritative tenancy context before creating a receivable.',
    );
  });

  it('rejects a receipt with nonexistent billing/tenancy context', async () => {
    const service = app.get(ReceiptService);
    await expectRejection(
      async () =>
        service.create({
          billingCycleId: 'bill_missing',
          tenancyId: 'ten_missing',
          amount: 3000000,
          paymentMethod: 'cash',
          paidAt: '2026-10-04T10:30:00.000Z',
        }),
      'Receipt must validate the receivable context it references.',
    );
  });

  it('rejects an incident that references a nonexistent room', async () => {
    const service = app.get(IncidentService);
    await expectRejection(
      async () =>
        service.create({
          roomId: 'room_missing',
          reporterId: 'actor_reference',
          title: 'Leak',
          description: 'Water leak',
          category: 'plumbing',
        }),
      'Incident must validate the room reference in its business context.',
    );
  });

  it('rejects a listing with nonexistent room/property references', async () => {
    const service = app.get(ListingService);
    await expectRejection(
      async () =>
        service.create({
          roomId: 'room_missing',
          propertyId: 'prop_missing',
          title: 'Room listing',
          description: 'Description',
          price: 3000000,
          locationSummary: 'District 9',
        }),
      'Listing must validate room/property context before publishing data can exist.',
    );
  });
});

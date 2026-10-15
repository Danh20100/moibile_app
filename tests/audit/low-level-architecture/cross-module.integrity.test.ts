import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BillingService } from '../../../src/modules/billing/services/billing.service';
import { IncidentService } from '../../../src/modules/incident/services/incident.service';
import { OrganizationService } from '../../../src/modules/organization/services/organization.service';
import { PropertyService } from '../../../src/modules/property/services/property.service';
import { ReceiptService } from '../../../src/modules/receipt/services/receipt.service';
import { RoomService } from '../../../src/modules/room/services/room.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from '../../core/support/in-memory-transaction-manager';

async function expectRejection(action: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, message);
}

function services() {
  const transactions = createCoreTestTransactionManager();
  const organizations = new OrganizationService(transactions);
  const properties = new PropertyService(organizations, transactions);
  const rooms = new RoomService(properties, transactions);
  const tenancy = new TenancyService(transactions);
  const billing = new BillingService(tenancy, transactions);
  return {
    properties,
    rooms,
    billing,
    receipts: new ReceiptService(billing, transactions),
    incidents: new IncidentService(rooms, transactions),
  };
}

describe('cross-module reference integrity audit', () => {
  it('rejects a property that references a nonexistent organization', async () => {
    const { properties } = services();
    await expectRejection(
      async () =>
        properties.create({
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
    const { rooms } = services();
    await expectRejection(
      async () => rooms.create({ propertyId: 'prop_missing', nameOrLabel: 'A-101' }),
      'Room must validate its property reference.',
    );
  });

  it('rejects a billing cycle with nonexistent tenancy/room context', async () => {
    const { billing } = services();
    await expectRejection(
      async () =>
        billing.createCycle({
          tenancyId: 'ten_missing',
          tenancyTermsId: 'terms_missing',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          charges: [{ type: 'RENT', amount: '3000000.00' }],
        }),
      'Billing must validate authoritative tenancy context before creating a receivable.',
    );
  });

  it('rejects a receipt with nonexistent billing/tenancy context', async () => {
    const { receipts } = services();
    await expectRejection(
      async () => receipts.issue('payment_missing'),
      'Receipt must validate the receivable context it references.',
    );
  });

  it('rejects an incident that references a nonexistent room', async () => {
    const { incidents } = services();
    await expectRejection(
      async () =>
        incidents.create({
          roomId: 'room_missing',
          reportedByUserId: 'actor_reference',
          category: 'PLUMBING',
        }),
      'Incident must validate the room reference in its business context.',
    );
  });
});

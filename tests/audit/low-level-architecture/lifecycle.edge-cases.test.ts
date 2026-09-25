import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BillingService } from '../../../src/modules/billing/services/billing.service';
async function expectRejection(action: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, message);
}

describe('lifecycle edge-case audit', () => {
  it('creates a future billing cycle in Upcoming state', async () => {
    const service = new BillingService();
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);

    const cycle = await service.createCycle({
      tenancyId: 'tenancy_reference',
      roomId: 'room_reference',
      cycleMonth: `${future.getUTCFullYear()}-10`,
      dueDate: `${future.getUTCFullYear()}-10-05`,
      charges: [{ type: 'rent', description: 'Rent', amount: 3000000 }],
    });

    assert.equal(
      cycle.status,
      'upcoming',
      'The documented billing lifecycle includes Upcoming -> Due; future cycles should not start as Due.',
    );
  });

  it('does not special-case a future 2099-01 billing cycle as Due', async () => {
    const service = new BillingService();
    const cycle = await service.createCycle({
      tenancyId: 'tenancy_reference',
      roomId: 'room_reference',
      cycleMonth: '2099-01',
      dueDate: '2099-01-31',
      charges: [{ type: 'rent', description: 'Rent', amount: 3000000 }],
    });

    assert.equal(
      cycle.status,
      'upcoming',
      'A future cycle must follow lifecycle semantics regardless of the literal cycleMonth value.',
    );
  });

  it('rejects a negative payment outcome at the business boundary', async () => {
    const service = new BillingService();
    const cycle = await service.createCycle({
      tenancyId: 'tenancy_reference',
      roomId: 'room_reference',
      cycleMonth: '2026-10',
      dueDate: '2099-10-05',
      charges: [{ type: 'rent', description: 'Rent', amount: 3000000 }],
    });

    await expectRejection(
      async () =>
        service.applyPaymentOutcome(cycle.id, {
          amountPaid: -1000,
          receiptId: 'receipt_reference',
        }),
      'Business services are exported across modules, so invalid payment outcomes must not rely only on HTTP DTO validation.',
    );
  });
});

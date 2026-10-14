import assert from 'node:assert/strict';
import test from 'node:test';
import { BillingService } from '../../../src/modules/billing/services/billing.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import { rentalFixture } from './guards/rental-test-support';

test('BillingCycle projects due date from persisted Terms and preserves unknown history as null', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const fixture = await rentalFixture(url);
  const tenancy = new TenancyService(fixture.manager);
  const billing = new BillingService(tenancy, fixture.manager);
  const tenancyId = fixture.ids.tenancy;
  try {
    await fixture.tenancies.createTenancy({ tenancyId, roomId: fixture.ids.room, status: 'DRAFT', startedAt: null, endedAt: null, endReason: null });
    await fixture.tenancies.insertTerms({
      tenancyTermsId: '83000000-0000-4000-8000-000000000001', tenancyId, version: 1,
      rentAmount: '100.00', agreedDepositRequirement: '0.00', termStart: '2026-01-01', termEnd: '2026-12-31',
      billingDayOrDueDateRule: { day: 31 }, electricityArrangement: {}, waterArrangement: {},
      minimalRentalConditions: {}, effectiveFromCycleBoundary: '2026-01-01',
    });
    const first = await billing.createCycle({ tenancyId, tenancyTermsId: '83000000-0000-4000-8000-000000000001',
      periodStart: '2026-02-01', periodEnd: '2026-02-28', charges: [{ type: 'RENT', amount: '100.00' }] });
    assert.equal((await billing.findById(first.id)).dueDate, '2026-02-28');

    await fixture.tenancies.insertTerms({
      tenancyTermsId: '83000000-0000-4000-8000-000000000002', tenancyId, version: 2,
      rentAmount: '100.00', agreedDepositRequirement: '0.00', termStart: '2026-03-01', termEnd: '2026-12-31',
      billingDayOrDueDateRule: {}, electricityArrangement: {}, waterArrangement: {},
      minimalRentalConditions: {}, effectiveFromCycleBoundary: '2026-03-01',
    });
    const historical = await billing.createCycle({ tenancyId, tenancyTermsId: '83000000-0000-4000-8000-000000000002',
      periodStart: '2026-03-01', periodEnd: '2026-03-31', charges: [{ type: 'RENT', amount: '100.00' }] });
    assert.equal((await billing.findById(historical.id)).dueDate, null);
  } finally {
    await fixture.db.destroy();
  }
});

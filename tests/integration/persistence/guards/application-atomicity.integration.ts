import assert from 'node:assert/strict';
import test from 'node:test';
import { BillingTransactionCoordinator } from '../../../../src/persistence/guards/billing-transaction-coordinator';
import { PostgresFinanceRepository } from '../../../../src/infrastructure/database/repositories/finance.repository';
import { rentalFixture } from './rental-test-support';

test('billing cycle and charges roll back together when a charge violates the frozen schema', async () => {
  const url=process.env.TEST_DATABASE_URL; assert.ok(url);
  const f=await rentalFixture(url); const coordinator=new BillingTransactionCoordinator(f.manager); const finance=new PostgresFinanceRepository(f.db);
  const terms='83000000-0000-4000-8000-000000000001',cycle='90000000-0000-4000-8000-000000000001';
  try {
    await f.tenancies.createTenancy({tenancyId:f.ids.tenancy,roomId:f.ids.room,status:'ACTIVE',startedAt:'2026-01-01T00:00:00.000Z',endedAt:null,endReason:null});
    await f.tenancies.insertTerms({tenancyTermsId:terms,tenancyId:f.ids.tenancy,version:1,rentAmount:'1.00',agreedDepositRequirement:'0.00',termStart:'2026-01-01',termEnd:'2026-12-31',billingDayOrDueDateRule:{},electricityArrangement:{},waterArrangement:{},minimalRentalConditions:{},effectiveFromCycleBoundary:'2026-01-01'});
    await assert.rejects(coordinator.createBillingCycle({billingCycleId:cycle,tenancyId:f.ids.tenancy,tenancyTermsId:terms,periodStart:'2026-01-01',periodEnd:'2026-01-31'},[{chargeId:'91000000-0000-4000-8000-000000000001',billingCycleId:cycle,chargeType:'INVALID',amount:'1.00',utilityConnectionId:null,startMeterReadingId:null,endMeterReadingId:null}]));
    assert.equal(await finance.findBillingCycle(cycle),undefined);
  } finally { await f.db.destroy(); }
});

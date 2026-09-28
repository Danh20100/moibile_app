import assert from 'node:assert/strict';
import test from 'node:test';
import { sql } from 'kysely';

import { runMigrations } from '../../../scripts/database/migrate';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresFinanceRepository } from '../../../src/infrastructure/database/repositories/finance.repository';
import { PersistenceCheckViolation } from '../../../src/persistence/errors';
import { resetPublicSchema } from './support/postgres-test-harness';

test('finance adapter preserves exact money and frozen vocabularies', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  await resetPublicSchema(url); await runMigrations('up', url);
  const db = createDatabaseClient({ url, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  const repo = new PostgresFinanceRepository(db);
  const user='10000000-0000-4000-8000-000000000001', room='40000000-0000-4000-8000-000000000001';
  const tenancy='80000000-0000-4000-8000-000000000001', terms='83000000-0000-4000-8000-000000000001';
  try {
    await sql`INSERT INTO users VALUES (${user})`.execute(db);
    await sql`INSERT INTO organizations VALUES ('20000000-0000-4000-8000-000000000001',${user},'Org')`.execute(db);
    await sql`INSERT INTO properties VALUES ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','P','ACTIVE','Private',ST_MakePoint(106,10)::geography,ST_MakePoint(106,10)::geography)`.execute(db);
    await sql`INSERT INTO rooms VALUES (${room},'30000000-0000-4000-8000-000000000001','R','VACANT','ACTIVE')`.execute(db);
    await sql`INSERT INTO tenancies VALUES (${tenancy},${room},'ACTIVE','2026-01-01T00:00:00Z',NULL,NULL)`.execute(db);
    await sql`INSERT INTO tenancy_terms VALUES (${terms},${tenancy},1,1,0,'2026-01-01','2026-12-31','{}','{}','{}','{}','2026-01-01')`.execute(db);
    await repo.insertBillingCycle({billingCycleId:'90000000-0000-4000-8000-000000000001',tenancyId:tenancy,tenancyTermsId:terms,periodStart:'2026-01-01',periodEnd:'2026-01-31'});
    await repo.insertCharge({chargeId:'91000000-0000-4000-8000-000000000001',billingCycleId:'90000000-0000-4000-8000-000000000001',chargeType:'RENT',amount:'9999999999999999.99',utilityConnectionId:null,startMeterReadingId:null,endMeterReadingId:null});
    await assert.rejects(repo.insertCharge({chargeId:'91000000-0000-4000-8000-000000000002',billingCycleId:'90000000-0000-4000-8000-000000000001',chargeType:'OTHER',amount:'1.00',utilityConnectionId:null,startMeterReadingId:null,endMeterReadingId:null}),PersistenceCheckViolation);
    await repo.insertPayment({paymentId:'92000000-0000-4000-8000-000000000001',tenancyId:tenancy,amount:'9999999999999999.99',source:'MANUAL_TRANSFER',verification:'USER_RECORDED',confirmedAt:'2026-01-02T00:00:00.000Z',voidedOrReversedAt:null,correctionNote:null,replacementPaymentId:null});
    await repo.insertPaymentAllocation({paymentAllocationId:'93000000-0000-4000-8000-000000000001',paymentId:'92000000-0000-4000-8000-000000000001',chargeId:'91000000-0000-4000-8000-000000000001',allocatedAmount:'9999999999999999.98'});
    assert.equal(await repo.sumPaymentCommittedAmount('92000000-0000-4000-8000-000000000001'),'9999999999999999.98');
    assert.equal((await repo.findCharge('91000000-0000-4000-8000-000000000001'))?.amount,'9999999999999999.99');
    await repo.insertDeposit({depositId:'94000000-0000-4000-8000-000000000001',tenancyId:tenancy});
    await repo.insertDepositPaymentApplication({depositPaymentApplicationId:'95000000-0000-4000-8000-000000000001',paymentId:'92000000-0000-4000-8000-000000000001',depositId:'94000000-0000-4000-8000-000000000001',appliedAmount:'100.25',appliedAt:'2026-01-03T00:00:00.000Z'});
    await repo.insertDepositSettlement({depositSettlementId:'96000000-0000-4000-8000-000000000001',depositId:'94000000-0000-4000-8000-000000000001',refundedAmount:'40.10',retainedAmount:'10.15',reasonOrNote:'final',actedByUserId:user,settledAt:'2026-01-04T00:00:00.000Z'});
    assert.equal(await repo.sumDepositFundedAmount('94000000-0000-4000-8000-000000000001'),'100.25');
    assert.equal(await repo.sumDepositSettledAmount('94000000-0000-4000-8000-000000000001'),'50.25');
  } finally { await db.destroy(); }
});

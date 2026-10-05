import { PostgresFinanceRepository } from '../../../src/infrastructure/database/repositories/finance.repository';
import { PostgresIdentityRepository } from '../../../src/infrastructure/database/repositories/identity.repository';
import { PostgresNotificationRepository } from '../../../src/infrastructure/database/repositories/notification.repository';
import { rentalFixture } from './guards/rental-test-support';

export async function gatewayFixture(url: string) {
  const f = await rentalFixture(url);
  try {
    const ids = {
      ...f.ids,
      creator: f.ids.user,
      recipient: '10000000-0000-4000-8000-000000000002',
      participant: '82000000-0000-4000-8000-000000000001',
      terms: '83000000-0000-4000-8000-000000000001',
      cycle: '90000000-0000-4000-8000-000000000001',
      charge: '91000000-0000-4000-8000-000000000001',
    };
    const amount = '1000.00';
    const identity = new PostgresIdentityRepository(f.db);
    const finance = new PostgresFinanceRepository(f.db);
    const notifications = new PostgresNotificationRepository(f.db);
    await identity.ensureUser(ids.recipient);
    await f.tenancies.createTenancy({
      tenancyId: ids.tenancy, roomId: ids.room, status: 'ACTIVE',
      startedAt: '2026-01-01T00:00:00.000Z', endedAt: null, endReason: null,
    });
    await f.tenancies.insertParticipant({
      tenancyParticipantId: ids.participant, tenancyId: ids.tenancy,
      userId: ids.recipient, role: 'PRIMARY',
      joinedAt: '2026-01-01T00:00:00.000Z', leftAt: null,
    });
    await f.tenancies.insertTerms({
      tenancyTermsId: ids.terms, tenancyId: ids.tenancy, version: 1,
      rentAmount: amount, agreedDepositRequirement: amount,
      termStart: '2026-01-01', termEnd: '2026-12-31',
      billingDayOrDueDateRule: {}, electricityArrangement: {}, waterArrangement: {},
      minimalRentalConditions: {}, effectiveFromCycleBoundary: '2026-01-01',
    });
    await finance.insertBillingCycle({
      billingCycleId: ids.cycle, tenancyId: ids.tenancy, tenancyTermsId: ids.terms,
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    await finance.insertCharge({
      chargeId: ids.charge, billingCycleId: ids.cycle, chargeType: 'RENT', amount,
      utilityConnectionId: null, startMeterReadingId: null, endMeterReadingId: null,
    });
    return { ...f, ids, amount, identity, finance, notifications };
  } catch (error) {
    await f.db.destroy();
    throw error;
  }
}

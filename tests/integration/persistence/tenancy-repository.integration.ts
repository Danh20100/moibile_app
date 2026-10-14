import assert from 'node:assert/strict';
import test from 'node:test';

import { runMigrations } from '../../../scripts/database/migrate';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresIdentityRepository } from '../../../src/infrastructure/database/repositories/identity.repository';
import { PostgresOrganizationRepository } from '../../../src/infrastructure/database/repositories/organization.repository';
import { PostgresPropertyRepository } from '../../../src/infrastructure/database/repositories/property.repository';
import { PostgresTenancyRepository } from '../../../src/infrastructure/database/repositories/tenancy.repository';
import { PersistenceUniqueViolation } from '../../../src/persistence/errors';
import type { TenancyRecord } from '../../../src/persistence/ports/tenancy.repository';
import { resetPublicSchema } from './support/postgres-test-harness';

test('tenancy adapter preserves vocabulary, exact values, uniqueness, dates, and nulls', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required');
  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);
  const database = createDatabaseClient({ url: databaseUrl, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  const identity = new PostgresIdentityRepository(database);
  const organizations = new PostgresOrganizationRepository(database);
  const properties = new PostgresPropertyRepository(database);
  const tenancies = new PostgresTenancyRepository(database);
  try {
    const userId = '11000000-0000-4000-8000-000000000001';
    const tenancyId = '81000000-0000-4000-8000-000000000001';
    const participantId = '82000000-0000-4000-8000-000000000001';
    const termsId = '83000000-0000-4000-8000-000000000001';
    await identity.ensureUser(userId);
    await organizations.createOrganization({ organizationId: '21000000-0000-4000-8000-000000000001', primaryOwnerUserId: userId, name: 'Owner' });
    await properties.createProperty({
      propertyId: '31000000-0000-4000-8000-000000000001', organizationId: '21000000-0000-4000-8000-000000000001',
      name: 'Property', lifecycleStatus: 'ACTIVE', operationalAddressText: 'Private',
      operationalLocation: { longitude: 106.7, latitude: 10.7 }, publicLocationProjection: { longitude: 106.7, latitude: 10.7 },
    });
    await properties.createRoom({
      roomId: '41000000-0000-4000-8000-000000000001', propertyId: '31000000-0000-4000-8000-000000000001',
      nameOrLabel: 'R1', operationalState: 'VACANT', recordLifecycle: 'ACTIVE',
    });
    const tenancy: TenancyRecord = {
      tenancyId, roomId: '41000000-0000-4000-8000-000000000001', status: 'DRAFT',
      startedAt: null, endedAt: null, endReason: null,
    };
    await tenancies.createTenancy(tenancy);
    for (const status of ['ACTIVE', 'ENDING', 'ENDED', 'CANCELLED']) {
      tenancy.status = status;
      await tenancies.updateTenancy(tenancy);
      assert.equal((await tenancies.findTenancy(tenancyId))?.status, status);
    }
    tenancy.status = 'ACTIVE';
    tenancy.startedAt = '2026-09-28T07:00:00.000Z';
    await tenancies.updateTenancy(tenancy);

    await tenancies.insertParticipant({
      tenancyParticipantId: participantId, tenancyId, userId, role: 'PRIMARY',
      joinedAt: '2026-09-28T07:00:00.000Z', leftAt: null,
    });
    assert.deepEqual(await tenancies.findActivePrimary(tenancyId), {
      tenancyParticipantId: participantId, tenancyId, userId, role: 'PRIMARY',
      joinedAt: '2026-09-28T07:00:00.000Z', leftAt: null,
    });
    await assert.rejects(tenancies.insertParticipant({
      tenancyParticipantId: '82000000-0000-4000-8000-000000000002', tenancyId, userId: null,
      role: 'PRIMARY', joinedAt: '2026-09-28T08:00:00.000Z', leftAt: null,
    }), PersistenceUniqueViolation);

    const terms = {
      tenancyTermsId: termsId, tenancyId, version: 1, rentAmount: '1234567890123456.78',
      agreedDepositRequirement: '2500000.00', termStart: '2026-09-28', termEnd: '2027-09-27',
      billingDayOrDueDateRule: { day: 5 }, electricityArrangement: { mode: 'METERED' },
      waterArrangement: { mode: 'FIXED' }, minimalRentalConditions: { note: 'exact' },
      effectiveFromCycleBoundary: '2026-10-01',
    };
    await tenancies.insertTerms(terms);
    assert.deepEqual(await tenancies.findTermsVersion(tenancyId, 1), terms);
    assert.deepEqual(await tenancies.findTermsById(termsId), terms);
    const historicalTerms = { ...terms, tenancyTermsId: '83000000-0000-4000-8000-000000000003', version: 2, billingDayOrDueDateRule: {} };
    await tenancies.insertTerms(historicalTerms);
    assert.deepEqual((await tenancies.findTermsById(historicalTerms.tenancyTermsId))?.billingDayOrDueDateRule, {},
      'historical JSON shape is returned unchanged');
    await assert.rejects(tenancies.insertTerms({ ...terms, tenancyTermsId: '83000000-0000-4000-8000-000000000002' }), PersistenceUniqueViolation);

    await tenancies.insertAcknowledgement({
      termsAcknowledgementId: '84000000-0000-4000-8000-000000000001', tenancyTermsId: termsId,
      tenancyParticipantId: participantId, userId, acknowledgedAt: '2026-09-28T09:00:00.000Z',
    });
    await tenancies.insertNotice({
      tenancyNoticeId: '85000000-0000-4000-8000-000000000001', tenancyId,
      noticeType: 'GENERAL', issuedByUserId: userId, contentOrNote: 'Notice',
      issuedAt: '2026-09-28T10:00:00.000Z', acknowledgedByUserId: null, acknowledgedAt: null,
    });
    assert.equal((await tenancies.findNonterminalByRoom(tenancy.roomId)).length, 1);
    assert.equal((await tenancies.findParticipantsByUser(userId)).length, 1);
  } finally { await database.destroy(); }
});

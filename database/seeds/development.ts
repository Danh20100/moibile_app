import {createDatabaseClient} from '../../src/infrastructure/database/database.client';import {loadDatabaseConfig} from '../../src/infrastructure/database/database.config';import {PostgresTransactionManager} from '../../src/infrastructure/database/postgres-transaction-manager';import {createRepositorySet} from '../../src/infrastructure/database/repositories/repository-set';import type {TransactionContext} from '../../src/persistence/ports/transaction-manager';import {DEVELOPMENT_SEED as s} from './seed-data';
export async function seedDevelopmentData(context: TransactionContext): Promise<void> {
  const r = context.repositories;
  await r.identity.ensureUser(s.userId);
  const existingOrg = await r.organization.findOrganization(s.organizationId);
  if (!existingOrg) {
    await r.organization.createOrganization({
      organizationId: s.organizationId,
      primaryOwnerUserId: s.userId,
      name: 'TrọƠi Synthetic Development Organization',
    });
  }
  const existingProperty = await r.property.findProperty(s.propertyId);
  if (!existingProperty) {
    await r.property.createProperty({
      propertyId: s.propertyId,
      organizationId: s.organizationId,
      name: 'Synthetic Development Property',
      lifecycleStatus: 'ACTIVE',
      operationalAddressText: 'Synthetic private address',
      operationalLocation: { longitude: 106.7, latitude: 10.7 },
      publicLocationProjection: { longitude: 106.701, latitude: 10.701 },
    });
  }
  const existingRoom = await r.property.findRoom(s.roomId);
  if (!existingRoom) {
    await r.property.createRoom({
      roomId: s.roomId,
      propertyId: s.propertyId,
      nameOrLabel: 'Synthetic Room',
      operationalState: 'VACANT',
      recordLifecycle: 'ACTIVE',
    });
  }
  await seedPaymentRoom(r);
}

async function seedPaymentRoom(r: TransactionContext['repositories']): Promise<void> {
  const existingRoom = await r.property.findRoom(s.paymentRoomId);
  if (!existingRoom) {
    await r.property.createRoom({
      roomId: s.paymentRoomId,
      propertyId: s.propertyId,
      nameOrLabel: 'Phòng 101',
      operationalState: 'OCCUPIED',
      recordLifecycle: 'ACTIVE',
    });
  }
  if (!(await r.listing.findListing(s.paymentListingId))) {
    await r.listing.createListing({
      listingId: s.paymentListingId,
      roomId: s.paymentRoomId,
      status: 'PUBLISHED',
      publicTitle: 'Phòng 101',
      publicDescription: 'Phòng dùng để thử thanh toán.',
      publicPriceProjection: '10000.00',
      publicLocationProjection: { longitude: 106.701, latitude: 10.701 },
    });
  }
  if (!(await r.tenancy.findTenancy(s.paymentTenancyId))) {
    await r.tenancy.createTenancy({
      tenancyId: s.paymentTenancyId,
      roomId: s.paymentRoomId,
      status: 'ACTIVE',
      startedAt: '2026-10-01T00:00:00.000Z',
      endedAt: null,
      endReason: null,
    });
  }
  if (!(await r.tenancy.findParticipant(s.paymentParticipantId))) {
    await r.tenancy.insertParticipant({
      tenancyParticipantId: s.paymentParticipantId,
      tenancyId: s.paymentTenancyId,
      userId: s.userId,
      role: 'PRIMARY',
      joinedAt: '2026-10-01T00:00:00.000Z',
      leftAt: null,
    });
  }
  if (!(await r.tenancy.findTermsById(s.paymentTermsId))) {
    await r.tenancy.insertTerms({
      tenancyTermsId: s.paymentTermsId,
      tenancyId: s.paymentTenancyId,
      version: 1,
      rentAmount: '10000.00',
      agreedDepositRequirement: '0.00',
      termStart: '2026-10-01',
      termEnd: '2027-09-30',
      billingDayOrDueDateRule: { day: 5 },
      electricityArrangement: { mode: 'included' },
      waterArrangement: { mode: 'included' },
      minimalRentalConditions: { occupants: 1 },
      effectiveFromCycleBoundary: '2026-10-01',
    });
  }
  if (!(await r.finance.findBillingCycle(s.paymentCycleId))) {
    await r.finance.insertBillingCycle({
      billingCycleId: s.paymentCycleId,
      tenancyId: s.paymentTenancyId,
      tenancyTermsId: s.paymentTermsId,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    });
  }
  if (!(await r.finance.findCharge(s.paymentChargeId))) {
    await r.finance.insertCharge({
      chargeId: s.paymentChargeId,
      billingCycleId: s.paymentCycleId,
      chargeType: 'RENT',
      amount: '10000.00',
      utilityConnectionId: null,
      startMeterReadingId: null,
      endMeterReadingId: null,
    });
  }
}
function assertDevelopmentSeedTarget(databaseUrl: string): void {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (name !== 'trooi_dev') throw new Error(`Refusing to seed ${name}. Development seed only runs against trooi_dev.`);
}
async function main(){const config=loadDatabaseConfig(process.env);assertDevelopmentSeedTarget(config.url);const db=createDatabaseClient(config);try{const manager=new PostgresTransactionManager(db,createRepositorySet);await manager.run(seedDevelopmentData);const demo=require('../../scripts/demo/fixture.cjs') as {seedDemoGraph:(tx:PostgresTransactionManager)=>Promise<void>;seedDemoMessages:(database:ReturnType<typeof createDatabaseClient>)=>Promise<void>};await demo.seedDemoGraph(manager);await demo.seedDemoMessages(db);}finally{await db.destroy();}}
if(require.main===module)void main().catch((error:unknown)=>{console.error(error instanceof Error?error.message:'Seed failed');process.exitCode=1;});

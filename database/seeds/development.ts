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
}
async function main(){const db=createDatabaseClient(loadDatabaseConfig(process.env));try{await new PostgresTransactionManager(db,createRepositorySet).run(seedDevelopmentData);}finally{await db.destroy();}}
if(require.main===module)void main().catch((error:unknown)=>{console.error(error instanceof Error?error.message:'Seed failed');process.exitCode=1;});

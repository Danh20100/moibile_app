import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { DATABASE_CLIENT } from '../../infrastructure/database/database.tokens';
import type { Kysely } from 'kysely';
import type { Database } from '../../infrastructure/database/schema.types';
import { ObjectStorageModule } from '../../infrastructure/object-storage/object-storage.module';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../persistence/ports/transaction-manager';
import type { GoogleIdTokenVerifier } from '../../integrations/google-identity';
import {
  createGoogleIdTokenVerifierFromEnv,
  GOOGLE_ID_TOKEN_VERIFIER,
} from '../../integrations/google-identity';

import { IdentityAccessController } from './controllers/identity-access.controller';
import { IdentityAccessService } from './services/identity-access.service';
import { GooglePrincipalResolver } from './services/google-principal-resolver';
import { ProfileAvatarService } from './services/profile-avatar.service';
import { IdentitySessionService } from './services/identity-session.service';
import { LocalDemoAuthService } from './services/local-demo-auth.service';

const googleIdTokenVerifierProvider = {
  provide: GOOGLE_ID_TOKEN_VERIFIER,
  useFactory: () => {
    try {
      return createGoogleIdTokenVerifierFromEnv();
    } catch {
      return undefined;
    }
  },
};

const googlePrincipalResolverProvider = {
  provide: GooglePrincipalResolver,
  inject: [TRANSACTION_MANAGER, GOOGLE_ID_TOKEN_VERIFIER, DATABASE_CLIENT],
  useFactory: (transactions: TransactionManager, verifier: GoogleIdTokenVerifier | undefined, database: Kysely<Database>) =>
    new GooglePrincipalResolver(transactions, verifier, undefined, false, database),
};

@Module({
  imports: [DatabaseModule, ObjectStorageModule],
  controllers: [IdentityAccessController],
  providers: [IdentityAccessService, IdentitySessionService, LocalDemoAuthService, ProfileAvatarService, googleIdTokenVerifierProvider, googlePrincipalResolverProvider],
  exports: [IdentityAccessService, IdentitySessionService, GooglePrincipalResolver, GOOGLE_ID_TOKEN_VERIFIER],
})
export class IdentityAccessModule {}

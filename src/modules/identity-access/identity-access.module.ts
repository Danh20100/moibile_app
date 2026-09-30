import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  createGoogleIdTokenVerifierFromEnv,
  GOOGLE_ID_TOKEN_VERIFIER,
} from '../../integrations/google-identity';

import { IdentityAccessController } from './controllers/identity-access.controller';
import { IdentityAccessService } from './services/identity-access.service';

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

@Module({
  imports: [DatabaseModule],
  controllers: [IdentityAccessController],
  providers: [IdentityAccessService, googleIdTokenVerifierProvider],
  exports: [IdentityAccessService, GOOGLE_ID_TOKEN_VERIFIER],
})
export class IdentityAccessModule {}

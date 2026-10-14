import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import {
  verifyGoogleIdToken,
  type GoogleIdTokenVerifier,
} from '../../../integrations/google-identity';
import type { TransactionManager } from '../../../persistence/ports/transaction-manager';
import type { VerifiedPrincipal } from '../contracts';
import { IdentityFoundationConflict } from '../../../persistence/ports/identity-foundation.repository';

@Injectable()
export class GooglePrincipalResolver {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly verifier?: GoogleIdTokenVerifier,
    private readonly enabled = process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED === 'true',
  ) {}

  async resolve(idToken: string): Promise<VerifiedPrincipal> {
    const verified = await verifyGoogleIdToken(this.verifier, idToken);
    if (!this.enabled) {
      throw new ServiceUnavailableException('Google account resolution is disabled pending identity session cutover');
    }

    let result: { kind: 'resolved'; userId: string } | { kind: 'unregistered' };
    try {
      result = await this.transactions.run(({ repositories }) =>
        repositories.identityFoundation.resolveGooglePrincipal({
          issuer: verified.issuer as 'accounts.google.com' | 'https://accounts.google.com',
          subject: verified.subject,
        }),
      );
    } catch (error) {
      if (error instanceof IdentityFoundationConflict) {
        throw new ServiceUnavailableException('Google account resolution is unavailable pending reviewed identity binding');
      }
      throw error;
    }
    if (result.kind !== 'resolved') {
      throw new ServiceUnavailableException('Google registration is unavailable pending verified-email completion');
    }
    return { ...verified, userId: result.userId };
  }
}

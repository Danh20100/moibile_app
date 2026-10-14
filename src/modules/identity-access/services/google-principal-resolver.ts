import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

import { verifyGoogleIdToken, type GoogleIdTokenVerifier } from '../../../integrations/google-identity';
import type { TransactionManager } from '../../../persistence/ports/transaction-manager';
import { IdentityFoundationConflict } from '../../../persistence/ports/identity-foundation.repository';
import type { VerifiedPrincipal } from '../contracts';

@Injectable()
export class GooglePrincipalResolver {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly verifier?: GoogleIdTokenVerifier,
    private readonly enabled = process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED === 'true',
    private readonly allowGoogleProofForTests = false,
  ) {}

  async resolve(idToken: string): Promise<VerifiedPrincipal> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Google account resolution is disabled pending identity session cutover');
    }
    if (this.allowGoogleProofForTests) {
      const verified = await verifyGoogleIdToken(this.verifier, idToken);
      let result;
      try {
        result = await this.transactions.run(({ repositories }) =>
          repositories.identityFoundation.resolveGooglePrincipal({
            issuer: verified.issuer as 'accounts.google.com' | 'https://accounts.google.com',
            subject: verified.subject,
          }),
        );
      } catch (error) {
        if (error instanceof IdentityFoundationConflict) {
          throw new ServiceUnavailableException('Google account binding requires reviewed identity cutover');
        }
        throw error;
      }
      if (result.kind !== 'resolved') throw new ServiceUnavailableException('Google registration is unavailable pending verified-email completion');
      return { ...verified, userId: result.userId };
    }

    const session = await this.transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: createHash('sha256').update(idToken).digest('hex'), now: new Date().toISOString(),
    }));
    if (!session) throw new UnauthorizedException('Application session is invalid or expired');
    return {
      userId: session.userId, provider: 'google', issuer: 'trooi.session', subject: session.sessionId,
      sessionId: session.sessionId, authenticatedAt: session.authenticatedAt,
    };
  }
}

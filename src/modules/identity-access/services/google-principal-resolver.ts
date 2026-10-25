import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../infrastructure/database/schema.types';

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
    private readonly localDevDatabase?: Kysely<Database>,
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
    let isLocalDev = false;
    if (this.localDevDatabase) {
      // A local-demo token cannot silently become a Google principal when
      // the demo feature is disabled or a production build is deployed.
      const table = await sql<{ exists: boolean }>`
        SELECT to_regclass('public.local_dev_accounts') IS NOT NULL AS exists
      `.execute(this.localDevDatabase);
      if (table.rows[0]?.exists) {
        const rows = await sql<{ exists: boolean }>`
          SELECT EXISTS(SELECT 1 FROM local_dev_accounts
            WHERE user_id = ${session.userId}::uuid AND mode = 'LOCAL_DEMO_ONLY') AS exists
        `.execute(this.localDevDatabase);
        isLocalDev = rows.rows[0]?.exists === true;
        if (isLocalDev && (process.env.NODE_ENV === 'production' ||
            process.env.TROOI_LOCAL_DEMO_AUTH !== 'true' ||
            process.env.TROOI_DATABASE_MODE !== 'compose-postgres')) {
          throw new UnauthorizedException('Local demo session is disabled');
        }
      }
    }
    return {
      userId: session.userId,
      provider: isLocalDev ? 'local_demo' : 'google',
      issuer: isLocalDev ? 'trooi.local.demo' : 'trooi.session',
      subject: session.sessionId,
      sessionId: session.sessionId, authenticatedAt: session.authenticatedAt,
    };
  }
}

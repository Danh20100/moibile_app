import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PersistenceRepositories } from '../../../persistence/ports/transaction-manager';
import type { IdentitySessionResponse } from './identity-session.service';

export async function issueSessionForUser(
  repositories: PersistenceRepositories,
  input: { userId: string; now: Date; authenticatedAt: string },
): Promise<IdentitySessionResponse> {
  const accessToken = randomBytes(32).toString('base64url');
  const refreshToken = randomBytes(32).toString('base64url');
  const sessionId = randomUUID();
  const digest = (token: string) => createHash('sha256').update(token).digest('hex');
  const absoluteExpiresAt = new Date(input.now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  await repositories.identitySessions.createSession({
    sessionId, familyId: sessionId, userId: input.userId,
    accessTokenSha256: digest(accessToken),
    accessExpiresAt: new Date(input.now.getTime() + 15 * 60 * 1000).toISOString(),
    refreshTokenSha256: digest(refreshToken),
    createdAt: input.now.toISOString(),
    idleExpiresAt: new Date(input.now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    absoluteExpiresAt, authenticatedAt: input.authenticatedAt,
  });
  return { userId: input.userId, sessionId, accessToken, refreshToken,
    tokenType: 'Bearer', expiresInSeconds: 900, refreshExpiresAt: absoluteExpiresAt };
}

import { randomUUID } from 'node:crypto';

import { normalizeLoginEmail } from '../../../common/identity/normalize-login-email';
import type { TransactionManager } from '../../../persistence/ports/transaction-manager';
import { hashPassword } from './password-hasher';

export function resetTestEmail(env: NodeJS.ProcessEnv): string | null {
  const raw = env.TROOI_RESET_TEST_EMAIL?.trim() ?? '';
  const password = env.TROOI_RESET_TEST_PASSWORD ?? '';
  if (!raw || !password) return null;
  try {
    return normalizeLoginEmail(raw);
  } catch {
    return null;
  }
}

export async function ensureResetTestUser(
  transactions: TransactionManager,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const email = resetTestEmail(env);
  const password = env.TROOI_RESET_TEST_PASSWORD ?? '';
  if (!email || !password) return;
  const existing = await transactions.run(({ repositories }) =>
    repositories.identityFoundation.findPrimaryLogin(email),
  );
  if (existing?.credential) return;
  const now = new Date().toISOString();
  const encodedHash = await hashPassword(password);
  try {
    await transactions.run(({ repositories }) =>
      repositories.identityFoundation.createEmailUserFoundation({
        userId: randomUUID(),
        email: {
          address: email,
          normalizedEmail: email,
          verifiedAt: now,
          verificationSource: 'email_otp',
        },
        displayName: 'Test',
        encodedHash,
        now,
      }),
    );
  } catch {
    return;
  }
}

import { UnauthorizedException } from '@nestjs/common';

import { googlePrincipalUserId } from '../../common/identity/deterministic-user-id';
import { GoogleIdentityVerificationError } from './google-identity.errors';
import { createGoogleIdTokenVerifierFromEnv } from './google-id-token-verifier.factory';
import type { GoogleIdTokenVerifier } from './google-identity.types';

export const GOOGLE_ID_TOKEN_VERIFIER = Symbol('GOOGLE_ID_TOKEN_VERIFIER');

export interface VerifiedPrincipalPayload {
  userId: string;
  provider: 'google';
  issuer: string;
  subject: string;
  email?: string;
  emailVerified?: boolean;
  nonce?: string;
  authTime?: number;
  issuedAt?: number;
  name?: string;
  pictureUrl?: string;
}

export async function verifyGoogleIdToken(
  verifier: GoogleIdTokenVerifier | undefined,
  idToken: string,
): Promise<VerifiedPrincipalPayload> {
  let effectiveVerifier = verifier;
  if (!effectiveVerifier) {
    try {
      effectiveVerifier = createGoogleIdTokenVerifierFromEnv();
    } catch {
      throw new UnauthorizedException('GOOGLE_CLIENT_ID chưa được cấu hình trên server');
    }
  }

  try {
    const identity = await effectiveVerifier.verify(idToken);
    const userId = googlePrincipalUserId(identity.issuer, identity.subject);
    return {
      userId,
      provider: 'google',
      issuer: identity.issuer,
      subject: identity.subject,
      ...(identity.email !== undefined ? { email: identity.email } : {}),
      ...(identity.emailVerified !== undefined ? { emailVerified: identity.emailVerified } : {}),
      ...(identity.nonce !== undefined ? { nonce: identity.nonce } : {}),
      ...(identity.authTime !== undefined ? { authTime: identity.authTime } : {}),
      ...(identity.issuedAt !== undefined ? { issuedAt: identity.issuedAt } : {}),
      ...(identity.name !== undefined ? { name: identity.name } : {}),
      ...(identity.pictureUrl !== undefined ? { pictureUrl: identity.pictureUrl } : {}),
    };
  } catch (error) {
    if (error instanceof GoogleIdentityVerificationError) {
      throw new UnauthorizedException(`Xác thực Google thất bại: ${error.code} - ${error.message}`);
    }
    if (error instanceof UnauthorizedException) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Xác thực token thất bại';
    throw new UnauthorizedException(`Xác thực token thất bại: ${message}`);
  }
}

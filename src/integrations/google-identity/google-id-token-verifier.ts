import { OAuth2Client } from 'google-auth-library';

import { GoogleIdentityVerificationError } from './google-identity.errors';
import type { GoogleIdentity, GoogleIdTokenVerifier } from './google-identity.types';

export interface GoogleTokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleIdTokenTicket {
  getPayload(): GoogleTokenPayload | undefined;
}

export interface GoogleIdTokenClient {
  verifyIdToken(options: { idToken: string; audience: string }): Promise<GoogleIdTokenTicket>;
}

export class GoogleAuthIdTokenVerifier implements GoogleIdTokenVerifier {
  private readonly clientId: string;

  constructor(
    clientId: string,
    private readonly client: GoogleIdTokenClient = new OAuth2Client(),
  ) {
    const normalizedClientId = clientId.trim();

    if (!normalizedClientId) {
      throw new GoogleIdentityVerificationError(
        'CONFIGURATION_ERROR',
        'Google client ID is required.',
      );
    }

    this.clientId = normalizedClientId;
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!idToken.trim()) {
      throw new GoogleIdentityVerificationError('INVALID_TOKEN', 'Google ID token is required.');
    }

    let ticket: GoogleIdTokenTicket;

    try {
      ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
    } catch {
      throw new GoogleIdentityVerificationError(
        'PROVIDER_ERROR',
        'Google ID token verification failed.',
      );
    }

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.sub.trim()) {
      throw new GoogleIdentityVerificationError(
        'INVALID_PAYLOAD',
        'Verified Google token does not contain a valid subject.',
      );
    }

    return {
      subject: payload.sub,
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.email_verified !== undefined ? { emailVerified: payload.email_verified } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.picture !== undefined ? { pictureUrl: payload.picture } : {}),
    };
  }
}

import { OAuth2Client } from 'google-auth-library';

import { GoogleIdentityVerificationError } from './google-identity.errors';
import type { GoogleIdentity, GoogleIdTokenVerifier } from './google-identity.types';

export interface GoogleTokenPayload {
  iss?: string;
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
    } catch (error) {
      let audienceMatches: boolean | null = null;
      try {
        const payloadPart = idToken.split('.')[1];
        if (payloadPart) {
          const payload = JSON.parse(
            Buffer.from(payloadPart, 'base64url').toString('utf8'),
          ) as { aud?: string | string[] };
          audienceMatches = Array.isArray(payload.aud)
            ? payload.aud.includes(this.clientId)
            : payload.aud === this.clientId;
        }
      } catch {
        audienceMatches = null;
      }
      console.warn('Google ID token verification diagnostic', {
        audienceMatches,
        providerError: error instanceof Error ? error.message : 'unknown',
      });
      throw new GoogleIdentityVerificationError(
        'PROVIDER_ERROR',
        'Google ID token verification failed.',
      );
    }

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.sub.trim() || !payload.iss || !payload.iss.trim()) {
      throw new GoogleIdentityVerificationError(
        'INVALID_PAYLOAD',
        'Verified Google token does not contain a valid subject.',
      );
    }

    return {
      issuer: payload.iss,
      subject: payload.sub,
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.email_verified !== undefined ? { emailVerified: payload.email_verified } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.picture !== undefined ? { pictureUrl: payload.picture } : {}),
    };
  }
}

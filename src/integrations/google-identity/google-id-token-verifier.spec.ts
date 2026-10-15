import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createGoogleIdTokenVerifierFromEnv } from './google-id-token-verifier.factory';

import {
  GoogleIdentityVerificationError,
  type GoogleIdentityErrorCode,
} from './google-identity.errors';
import {
  GoogleAuthIdTokenVerifier,
  type GoogleIdTokenClient,
  type GoogleTokenPayload,
} from './google-id-token-verifier';

function expectIntegrationError(code: GoogleIdentityErrorCode) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof GoogleIdentityVerificationError);
    assert.equal(error.code, code);
    return true;
  };
}

function clientWithPayload(
  payload: GoogleTokenPayload | undefined,
  expectedToken = 'valid-token',
  expectedAudience = 'google-client-id',
): GoogleIdTokenClient {
  return {
    async verifyIdToken(options) {
      assert.equal(options.idToken, expectedToken);
      assert.equal(options.audience, expectedAudience);
      return {
        getPayload: () => payload ? { iss: 'https://accounts.google.com', iat: 1_797_000_000, ...payload } : undefined,
      };
    },
  };
}

describe('GoogleAuthIdTokenVerifier', () => {
  it('normalizes a valid verified Google payload', async () => {
    const verifier = new GoogleAuthIdTokenVerifier(
      '  google-client-id  ',
      clientWithPayload({
        sub: 'google-subject',
        email: 'user@example.com',
        email_verified: true,
        name: 'TrọƠi User',
        picture: 'https://example.com/avatar.png',
      }),
    );

    const identity = await verifier.verify('valid-token');

    assert.deepEqual(identity, {
      issuer: 'https://accounts.google.com',
      subject: 'google-subject',
      email: 'user@example.com',
      emailVerified: true,
      issuedAt: 1_797_000_000,
      name: 'TrọƠi User',
      pictureUrl: 'https://example.com/avatar.png',
    });
  });

  it('accepts a valid payload when optional claims are absent', async () => {
    const verifier = new GoogleAuthIdTokenVerifier(
      'google-client-id',
      clientWithPayload({ sub: 'google-subject' }),
    );

    assert.deepEqual(await verifier.verify('valid-token'), {
      issuer: 'https://accounts.google.com',
      subject: 'google-subject',
      issuedAt: 1_797_000_000,
    });
  });

  it('preserves email_verified false', async () => {
    const verifier = new GoogleAuthIdTokenVerifier(
      'google-client-id',
      clientWithPayload({
        sub: 'google-subject',
        email_verified: false,
      }),
    );

    assert.deepEqual(await verifier.verify('valid-token'), {
      issuer: 'https://accounts.google.com',
      subject: 'google-subject',
      emailVerified: false,
      issuedAt: 1_797_000_000,
    });
  });

  it('preserves nonce, authentication time, and issuance time from verified claims', async () => {
    const verifier = new GoogleAuthIdTokenVerifier('google-client-id', clientWithPayload({
      sub: 'google-subject', nonce: 'one-time-challenge', auth_time: 1_797_000_000, iat: 1_797_000_030,
    }));
    assert.deepEqual(await verifier.verify('valid-token'), {
      issuer: 'https://accounts.google.com', subject: 'google-subject', nonce: 'one-time-challenge',
      authTime: 1_797_000_000, issuedAt: 1_797_000_030,
    });
  });

  it('rejects an unsupported verified issuer', async () => {
    const verifier = new GoogleAuthIdTokenVerifier('google-client-id', clientWithPayload({
      iss: 'https://attacker.example', sub: 'google-subject',
    }));
    await assert.rejects(() => verifier.verify('valid-token'), expectIntegrationError('INVALID_PAYLOAD'));
  });

  it('rejects an empty or whitespace-only token before calling Google', async () => {
    let calls = 0;

    const client: GoogleIdTokenClient = {
      async verifyIdToken() {
        calls += 1;
        throw new Error('must not be called');
      },
    };

    const verifier = new GoogleAuthIdTokenVerifier('google-client-id', client);

    await assert.rejects(() => verifier.verify(''), expectIntegrationError('INVALID_TOKEN'));

    await assert.rejects(() => verifier.verify('   '), expectIntegrationError('INVALID_TOKEN'));

    assert.equal(calls, 0);
  });

  it('rejects a verified payload without a usable sub claim', async () => {
    const missingSub = new GoogleAuthIdTokenVerifier('google-client-id', clientWithPayload({}));

    const whitespaceSub = new GoogleAuthIdTokenVerifier(
      'google-client-id',
      clientWithPayload({ sub: '   ' }),
    );

    await assert.rejects(
      () => missingSub.verify('valid-token'),
      expectIntegrationError('INVALID_PAYLOAD'),
    );

    await assert.rejects(
      () => whitespaceSub.verify('valid-token'),
      expectIntegrationError('INVALID_PAYLOAD'),
    );
  });

  it('maps Google client failures to a safe provider error', async () => {
    const client: GoogleIdTokenClient = {
      async verifyIdToken() {
        throw 'sensitive vendor failure';
      },
    };

    const verifier = new GoogleAuthIdTokenVerifier('google-client-id', client);

    await assert.rejects(
      () => verifier.verify('valid-token'),
      (error: unknown) => {
        assert.ok(error instanceof GoogleIdentityVerificationError);
        assert.equal(error.code, 'PROVIDER_ERROR');
        assert.equal(error.message, 'Google ID token verification failed.');
        assert.equal(error.message.includes('sensitive vendor failure'), false);
        return true;
      },
    );
  });
});

describe('createGoogleIdTokenVerifierFromEnv', () => {
  it('fails early when GOOGLE_CLIENT_ID is missing', () => {
    assert.throws(
      () => createGoogleIdTokenVerifierFromEnv({}),
      expectIntegrationError('CONFIGURATION_ERROR'),
    );
  });

  it('fails early when GOOGLE_CLIENT_ID contains only whitespace', () => {
    assert.throws(
      () =>
        createGoogleIdTokenVerifierFromEnv({
          GOOGLE_CLIENT_ID: '   ',
        }),
      expectIntegrationError('CONFIGURATION_ERROR'),
    );
  });

  it('creates a verifier when GOOGLE_CLIENT_ID is configured', () => {
    const verifier = createGoogleIdTokenVerifierFromEnv({
      GOOGLE_CLIENT_ID: 'google-client-id',
    });

    assert.equal(typeof verifier.verify, 'function');
  });
});

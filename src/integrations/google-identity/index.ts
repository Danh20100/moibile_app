export { GoogleIdentityVerificationError } from './google-identity.errors';
export type { GoogleIdentityErrorCode } from './google-identity.errors';

export { GoogleAuthIdTokenVerifier } from './google-id-token-verifier';

export { createGoogleIdTokenVerifierFromEnv } from './google-id-token-verifier.factory';

export type { GoogleIdentity, GoogleIdTokenVerifier } from './google-identity.types';

export {
  GOOGLE_ID_TOKEN_VERIFIER,
  verifyGoogleIdToken,
  type VerifiedPrincipalPayload,
} from './verify-token';

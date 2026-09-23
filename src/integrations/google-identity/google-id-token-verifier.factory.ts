import { GoogleAuthIdTokenVerifier } from './google-id-token-verifier';
import type { GoogleIdTokenVerifier } from './google-identity.types';

export function createGoogleIdTokenVerifierFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): GoogleIdTokenVerifier {
  return new GoogleAuthIdTokenVerifier(env.GOOGLE_CLIENT_ID ?? '');
}

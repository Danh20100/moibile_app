import {
  GoogleIdentityVerificationError,
  createGoogleIdTokenVerifierFromEnv,
} from '../../../src/integrations/google-identity';

async function main(): Promise<void> {
  const idToken = process.env.GOOGLE_ID_TOKEN?.trim();

  if (!idToken) {
    throw new Error('GOOGLE_ID_TOKEN is required for the Google Identity live test.');
  }

  const verifier = createGoogleIdTokenVerifierFromEnv();
  const identity = await verifier.verify(idToken);

  console.log('Google ID token verified successfully.');
  console.log({
    subject: identity.subject,
    email: identity.email,
    emailVerified: identity.emailVerified,
    name: identity.name,
    pictureUrl: identity.pictureUrl,
  });
}

main().catch((error: unknown) => {
  if (error instanceof GoogleIdentityVerificationError) {
    console.error(`Google Identity error [${error.code}]: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown live-test failure.');
  }

  process.exitCode = 1;
});

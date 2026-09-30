export interface GoogleIdentity {
  issuer: string;
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  pictureUrl?: string;
}

export interface GoogleIdTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

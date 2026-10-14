export interface GoogleIdentity {
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

export interface GoogleIdTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

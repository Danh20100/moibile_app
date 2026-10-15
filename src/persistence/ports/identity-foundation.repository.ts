export type Revision = string;
export interface GooglePrincipal {
  issuer: 'accounts.google.com' | 'https://accounts.google.com';
  subject: string;
}
export interface VerifiedEmail {
  address: string;
  normalizedEmail: string;
  verifiedAt: string;
  verificationSource: 'google' | 'email_otp';
}
export interface EmailRecord extends VerifiedEmail {
  userId: string;
  userEmailId: string;
  emailRevision: Revision;
}
export interface ProfileRecord {
  userId: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CredentialRecord {
  userId: string;
  passwordHash: string;
  credentialRevision: Revision;
  createdAt: string;
  passwordChangedAt: string;
}
export interface FoundationInput {
  principal: GooglePrincipal;
  email: VerifiedEmail;
  displayName: string | null;
  now: string;
}
export interface ProofSnapshot {
  userId: string;
  userEmailId: string;
  emailRevision: Revision;
  credentialRevision: Revision | null;
}
export interface LoginSnapshot extends Omit<ProofSnapshot, 'credentialRevision'> {
  normalizedEmail: string;
  credentialRevision: Revision;
}
export type IdentityConflictCode =
  | 'principal_conflict'
  | 'legacy_conflict'
  | 'email_conflict'
  | 'stale_state'
  | 'credential_exists'
  | 'google_binding_required'
  | 'user_not_found'
  | 'profile_missing'
  | 'invalid_email'
  | 'invalid_principal'
  | 'invalid_hash'
  | 'invalid_profile'
  | 'revision_exhausted';
export class IdentityFoundationConflict extends Error {
  constructor(readonly code: IdentityConflictCode) {
    super(code);
    this.name = 'IdentityFoundationConflict';
  }
}
// Transaction-bound storage only. Callers verify proofs/authorize resolved Users and supply atomic audit/session collaborators before activation.
// Conflicts throw so TransactionManager rolls back; never convert them to a successful transaction result.
export interface IdentityFoundationRepository {
  resolveGooglePrincipal(
    principal: GooglePrincipal,
  ): Promise<{ kind: 'resolved'; userId: string } | { kind: 'unregistered' }>;
  createGoogleUserFoundation(
    input: FoundationInput,
  ): Promise<{ userId: string; email: EmailRecord; profile: ProfileRecord }>;
  initializeLegacyFoundation(
    input: FoundationInput & { userId: string },
  ): Promise<{ email: EmailRecord; profile: ProfileRecord }>;
  findPrimaryLogin(
    normalizedEmail: string,
  ): Promise<{ email: EmailRecord; credential: CredentialRecord | null } | null>;
  replacePrimaryEmail(input: {
    userId: string;
    expectedEmailId: string;
    expectedEmailRevision: Revision;
    target: VerifiedEmail;
  }): Promise<EmailRecord>;
  initializeProfileIfAbsent(input: {
    userId: string;
    displayName: string | null;
    now: string;
  }): Promise<ProfileRecord>;
  updateOwnDisplayName(input: {
    userId: string;
    displayName: string;
    now: string;
  }): Promise<ProfileRecord>;
  insertPasswordCredential(input: {
    userId: string;
    encodedHash: string;
    now: string;
  }): Promise<CredentialRecord>;
  replacePasswordCredential(input: {
    userId: string;
    expectedRevision: Revision;
    encodedHash: string;
    kind: 'change' | 'reset' | 'rehash';
    now: string;
  }): Promise<CredentialRecord>;
  validateProofSnapshot(expected: ProofSnapshot): Promise<void>;
  validateLoginSnapshot(expected: LoginSnapshot): Promise<LoginSnapshot>;
}

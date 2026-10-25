export interface UserReference {
  userId: string;
}

export interface VerifiedPrincipal extends UserReference {
  provider: 'google' | 'local_demo';
  issuer: string;
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  pictureUrl?: string;
  sessionId?: string;
  authenticatedAt?: string;
}

export interface SessionContext {
  userId: string;
  operatedOrganizationIds: string[];
  linkedTenancyIds: string[];
  email?: string;
  name?: string;
  pictureUrl?: string;
}

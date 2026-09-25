export type UserRole = 'owner' | 'operator' | 'tenant' | 'platform_admin';

export interface UserReference {
  userId: string;
}

export interface UserProfile {
  id: string;
  externalSubject: string;
  role?: UserRole;
  email?: string;
  name?: string;
  pictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}

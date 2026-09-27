export type SubscriptionPlan = 'free' | 'starter' | 'pro';

export interface EntitlementDecision {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
}

export interface OrganizationSubscription {
  organizationId: string;
  plan: SubscriptionPlan;
  maxRooms: number;
  capabilities: string[];
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

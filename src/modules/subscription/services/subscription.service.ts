import { Injectable } from '@nestjs/common';

import { EntitlementDecision, OrganizationSubscription, SubscriptionPlan } from '../contracts';
import { AssignSubscriptionDto } from '../dto';

const PLAN_CAPABILITIES: Record<SubscriptionPlan, { maxRooms: number; capabilities: string[] }> = {
  free: {
    maxRooms: 10,
    capabilities: ['basic_operations'],
  },
  starter: {
    maxRooms: 50,
    capabilities: ['basic_operations', 'bulk_onboarding', 'export_reports'],
  },
  pro: {
    maxRooms: 9999,
    capabilities: [
      'basic_operations',
      'bulk_onboarding',
      'export_reports',
      'api_access',
      'priority_support',
    ],
  },
};

@Injectable()
export class SubscriptionService {
  private readonly subscriptions = new Map<string, OrganizationSubscription>();

  async assignPlan(dto: AssignSubscriptionDto): Promise<OrganizationSubscription> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + dto.durationDays * 24 * 60 * 60 * 1000);
    const planInfo = PLAN_CAPABILITIES[dto.plan];

    const sub: OrganizationSubscription = {
      organizationId: dto.organizationId,
      plan: dto.plan,
      maxRooms: planInfo.maxRooms,
      capabilities: planInfo.capabilities,
      expiresAt: expiresAt.toISOString(),
      isActive: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.subscriptions.set(dto.organizationId, sub);
    return sub;
  }

  async getSubscription(organizationId: string): Promise<OrganizationSubscription> {
    const sub = this.subscriptions.get(organizationId);
    if (!sub) {
      // Default to free tier if not explicitly subscribed
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const freePlan = PLAN_CAPABILITIES.free;
      const defaultSub: OrganizationSubscription = {
        organizationId,
        plan: 'free',
        maxRooms: freePlan.maxRooms,
        capabilities: freePlan.capabilities,
        expiresAt: expiresAt.toISOString(),
        isActive: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      this.subscriptions.set(organizationId, defaultSub);
      return defaultSub;
    }

    const isExpired = new Date(sub.expiresAt) < new Date();
    if (isExpired && sub.isActive) {
      sub.isActive = false;
      sub.updatedAt = new Date().toISOString();
    }

    return sub;
  }

  async checkEntitlement(organizationId: string, capability: string): Promise<EntitlementDecision> {
    const sub = await this.getSubscription(organizationId);

    if (!sub.isActive) {
      return {
        allowed: false,
        reason: 'Gói dịch vụ của tổ chức đã hết hạn',
      };
    }

    const allowed = sub.capabilities.includes(capability);
    return {
      allowed,
      reason: allowed
        ? undefined
        : `Gói '${sub.plan}' không bao gồm quyền hạn tính năng: '${capability}'`,
    };
  }
}

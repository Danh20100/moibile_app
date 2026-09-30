import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  BillingCycleRecord,
  PaymentRecord,
  ReceiptRecord,
} from '../../persistence/ports/finance.repository';
import type { IncidentRecord } from '../../persistence/ports/incident.repository';
import type { ListingRecord } from '../../persistence/ports/listing.repository';
import type { OrganizationRecord } from '../../persistence/ports/organization.repository';
import type { PropertyRecord, RoomRecord } from '../../persistence/ports/property.repository';
import type { TenancyRecord } from '../../persistence/ports/tenancy.repository';
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '../../persistence/ports/transaction-manager';

@Injectable()
export class ResourceAuthorizationService {
  constructor(
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  async assertOperatesOrganization(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationRecord> {
    const org = await this.transactions.run(({ repositories }) =>
      repositories.organization.findOrganization(organizationId),
    );
    if (!org) {
      throw new NotFoundException(`Không tìm thấy tổ chức với ID: ${organizationId}`);
    }
    if (org.primaryOwnerUserId !== userId) {
      throw new ForbiddenException('Bạn không có quyền quản lý tổ chức này');
    }
    return org;
  }

  async isOperatorOfOrganization(userId: string, organizationId: string): Promise<boolean> {
    try {
      await this.assertOperatesOrganization(userId, organizationId);
      return true;
    } catch {
      return false;
    }
  }

  async assertOperatesProperty(userId: string, propertyId: string): Promise<PropertyRecord> {
    const prop = await this.transactions.run(({ repositories }) =>
      repositories.property.findProperty(propertyId),
    );
    if (!prop) {
      throw new NotFoundException(`Không tìm thấy bất động sản với ID: ${propertyId}`);
    }
    await this.assertOperatesOrganization(userId, prop.organizationId);
    return prop;
  }

  async isOperatorOfProperty(userId: string, propertyId: string): Promise<boolean> {
    try {
      await this.assertOperatesProperty(userId, propertyId);
      return true;
    } catch {
      return false;
    }
  }

  async assertOperatesRoom(userId: string, roomId: string): Promise<RoomRecord> {
    const room = await this.transactions.run(({ repositories }) =>
      repositories.property.findRoom(roomId),
    );
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng với ID: ${roomId}`);
    }
    await this.assertOperatesProperty(userId, room.propertyId);
    return room;
  }

  async isOperatorOfRoom(userId: string, roomId: string): Promise<boolean> {
    try {
      await this.assertOperatesRoom(userId, roomId);
      return true;
    } catch {
      return false;
    }
  }

  async assertOperatesListing(userId: string, listingId: string): Promise<ListingRecord> {
    const listing = await this.transactions.run(({ repositories }) =>
      repositories.listing.findListing(listingId),
    );
    if (!listing) {
      throw new NotFoundException(`Không tìm thấy tin đăng với ID: ${listingId}`);
    }
    await this.assertOperatesRoom(userId, listing.roomId);
    return listing;
  }

  async isOperatorOfListing(userId: string, listingId: string): Promise<boolean> {
    try {
      await this.assertOperatesListing(userId, listingId);
      return true;
    } catch {
      return false;
    }
  }

  async assertOperatesTenancy(userId: string, tenancyId: string): Promise<TenancyRecord> {
    const tenancy = await this.transactions.run(({ repositories }) =>
      repositories.tenancy.findTenancy(tenancyId),
    );
    if (!tenancy) {
      throw new NotFoundException(`Không tìm thấy hợp đồng thuê với ID: ${tenancyId}`);
    }
    await this.assertOperatesRoom(userId, tenancy.roomId);
    return tenancy;
  }

  async isOperatorOfTenancy(userId: string, tenancyId: string): Promise<boolean> {
    try {
      await this.assertOperatesTenancy(userId, tenancyId);
      return true;
    } catch {
      return false;
    }
  }

  async isParticipantInTenancy(userId: string, tenancyId: string): Promise<boolean> {
    const participants = await this.transactions.run(({ repositories }) =>
      repositories.tenancy.findParticipantsByTenancy(tenancyId),
    );
    return participants.some((p) => p.userId === userId && p.leftAt === null);
  }

  async hasParticipantHistoryInTenancy(userId: string, tenancyId: string): Promise<boolean> {
    const participants = await this.transactions.run(({ repositories }) =>
      repositories.tenancy.findParticipantsByTenancy(tenancyId),
    );
    return participants.some((p) => p.userId === userId);
  }

  async assertCanReadTenancy(userId: string, tenancyId: string): Promise<TenancyRecord> {
    const tenancy = await this.transactions.run(({ repositories }) =>
      repositories.tenancy.findTenancy(tenancyId),
    );
    if (!tenancy) {
      throw new NotFoundException(`Tenancy not found: ${tenancyId}`);
    }
    if (await this.isOperatorOfRoom(userId, tenancy.roomId)) {
      return tenancy;
    }
    if (await this.hasParticipantHistoryInTenancy(userId, tenancyId)) {
      return tenancy;
    }
    throw new ForbiddenException('You do not have permission to read this tenancy');
  }

  async assertCanAccessTenancy(userId: string, tenancyId: string): Promise<TenancyRecord> {
    const tenancy = await this.transactions.run(({ repositories }) =>
      repositories.tenancy.findTenancy(tenancyId),
    );
    if (!tenancy) {
      throw new NotFoundException(`Không tìm thấy hợp đồng thuê với ID: ${tenancyId}`);
    }
    if (await this.isOperatorOfRoom(userId, tenancy.roomId)) {
      return tenancy;
    }
    if (await this.isParticipantInTenancy(userId, tenancyId)) {
      return tenancy;
    }
    throw new ForbiddenException('Bạn không có quyền truy cập hợp đồng thuê này');
  }

  async assertCanAccessRoom(userId: string, roomId: string): Promise<RoomRecord> {
    const room = await this.transactions.run(({ repositories }) =>
      repositories.property.findRoom(roomId),
    );
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng với ID: ${roomId}`);
    }
    if (await this.isOperatorOfProperty(userId, room.propertyId)) {
      return room;
    }
    const tenancies = await this.transactions.run(({ repositories }) =>
      repositories.tenancy.findTenanciesByRoom(roomId),
    );
    for (const t of tenancies) {
      if (await this.isParticipantInTenancy(userId, t.tenancyId)) {
        return room;
      }
    }
    throw new ForbiddenException('Bạn không có quyền truy cập phòng này');
  }

  async assertCanAccessBillingCycle(
    userId: string,
    billingCycleId: string,
  ): Promise<BillingCycleRecord> {
    const cycle = await this.transactions.run(({ repositories }) =>
      repositories.finance.findBillingCycle(billingCycleId),
    );
    if (!cycle) {
      throw new NotFoundException(`Không tìm thấy chu kỳ thanh toán với ID: ${billingCycleId}`);
    }
    await this.assertCanReadTenancy(userId, cycle.tenancyId);
    return cycle;
  }

  async assertCanAccessPayment(userId: string, paymentId: string): Promise<PaymentRecord> {
    const payment = await this.transactions.run(({ repositories }) =>
      repositories.finance.findPayment(paymentId),
    );
    if (!payment) {
      throw new NotFoundException(`Không tìm thấy thanh toán với ID: ${paymentId}`);
    }
    await this.assertCanReadTenancy(userId, payment.tenancyId);
    return payment;
  }

  async assertCanAccessReceipt(userId: string, receiptId: string): Promise<ReceiptRecord> {
    const receipt = await this.transactions.run(({ repositories }) =>
      repositories.finance.findReceipt(receiptId),
    );
    if (!receipt) {
      throw new NotFoundException(`Không tìm thấy biên lai với ID: ${receiptId}`);
    }
    await this.assertCanAccessPayment(userId, receipt.paymentId);
    return receipt;
  }

  async assertCanAccessIncident(userId: string, incidentId: string): Promise<IncidentRecord> {
    const incident = await this.transactions.run(({ repositories }) =>
      repositories.incident.findIncident(incidentId),
    );
    if (!incident) {
      throw new NotFoundException(`Không tìm thấy sự cố với ID: ${incidentId}`);
    }
    if (incident.reportedByUserId === userId) {
      return incident;
    }
    await this.assertCanAccessRoom(userId, incident.roomId);
    return incident;
  }

  async assertOperatesIncident(userId: string, incidentId: string): Promise<IncidentRecord> {
    const incident = await this.transactions.run(({ repositories }) =>
      repositories.incident.findIncident(incidentId),
    );
    if (!incident) {
      throw new NotFoundException(`Không tìm thấy sự cố với ID: ${incidentId}`);
    }
    await this.assertOperatesRoom(userId, incident.roomId);
    return incident;
  }

  async getOperatedOrganizationIds(userId: string): Promise<string[]> {
    const orgs = await this.transactions.run(({ repositories }) =>
      repositories.organization.findByPrimaryOwnerUserId(userId),
    );
    return orgs.map((o) => o.organizationId);
  }

  async getOperatedPropertyIds(userId: string): Promise<string[]> {
    const orgIds = await this.getOperatedOrganizationIds(userId);
    if (orgIds.length === 0) return [];
    return this.transactions.run(async ({ repositories }) => {
      const propIds: string[] = [];
      for (const orgId of orgIds) {
        const props = await repositories.property.findPropertiesByOrganization(orgId);
        propIds.push(...props.map((p) => p.propertyId));
      }
      return propIds;
    });
  }

  async getLinkedTenancyIds(userId: string): Promise<string[]> {
    const participants = await this.transactions.run(({ repositories }) =>
      repositories.tenancy.findParticipantsByUser(userId),
    );
    return Array.from(
      new Set(participants.filter((p) => p.leftAt === null).map((p) => p.tenancyId)),
    );
  }
}

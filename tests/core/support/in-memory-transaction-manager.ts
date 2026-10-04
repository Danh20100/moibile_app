import type { OrganizationRecord } from '../../../src/persistence/ports/organization.repository';
import type {
  PropertyRecord,
  RoomRecord,
} from '../../../src/persistence/ports/property.repository';
import type { TransactionManager } from '../../../src/persistence/ports/transaction-manager';
import type {
  InquiryRecord,
  ListingRecord,
  ListingStatusEventRecord,
} from '../../../src/persistence/ports/listing.repository';
import type {
  TenancyNoticeRecord,
  TenancyParticipantRecord,
  TenancyRecord,
  TenancyTermsRecord,
  TermsAcknowledgementRecord,
} from '../../../src/persistence/ports/tenancy.repository';
import type {
  BillingCycleRecord,
  ChargeRecord,
  DepositEventRecord,
  DepositPaymentApplicationRecord,
  DepositRecord,
  DepositSettlementRecord,
  GatewayCheckoutRecord,
  PaymentAllocationRecord,
  PaymentRecord,
  ReceiptRecord,
} from '../../../src/persistence/ports/finance.repository';
import type {
  IncidentEventRecord,
  IncidentRecord,
} from '../../../src/persistence/ports/incident.repository';
import type { TrustReportRecord } from '../../../src/persistence/ports/trust.repository';
import type { NotificationRecord } from '../../../src/persistence/ports/notification.repository';

export function createCoreTestTransactionManager(): TransactionManager {
  const users = new Set<string>();
  const organizations = new Map<string, OrganizationRecord>();
  const properties = new Map<string, PropertyRecord>();
  const rooms = new Map<string, RoomRecord>();
  const listings = new Map<string, ListingRecord>();
  const listingEvents: ListingStatusEventRecord[] = [];
  const inquiries = new Map<string, InquiryRecord>();
  const tenancies = new Map<string, TenancyRecord>();
  const participants = new Map<string, TenancyParticipantRecord>();
  const terms = new Map<string, TenancyTermsRecord>();
  const acknowledgements = new Map<string, TermsAcknowledgementRecord>();
  const notices = new Map<string, TenancyNoticeRecord>();
  const cycles = new Map<string, BillingCycleRecord>(),
    charges = new Map<string, ChargeRecord>(),
    payments = new Map<string, PaymentRecord>(),
    allocations = new Map<string, PaymentAllocationRecord>(),
    deposits = new Map<string, DepositRecord>(),
    applications = new Map<string, DepositPaymentApplicationRecord>(),
    settlements = new Map<string, DepositSettlementRecord>(),
    depositEvents = new Map<string, DepositEventRecord>(),
    receipts = new Map<string, ReceiptRecord>(),
    checkouts = new Map<string, GatewayCheckoutRecord>();
  const incidents = new Map<string, IncidentRecord>(),
    incidentEvents: IncidentEventRecord[] = [];
  const trustReports = new Map<string, TrustReportRecord>();
  const notifications = new Map<string, NotificationRecord>();
  const repositories = {
    identity: {
      ensureUser: async (id: string) => {
        users.add(id);
      },
      userExists: async (id: string) => users.has(id),
    },
    organization: {
      createOrganization: async (value: OrganizationRecord) => {
        organizations.set(value.organizationId, structuredClone(value));
      },
      findOrganization: async (id: string) => structuredClone(organizations.get(id)),
      findOrganizations: async () =>
        Array.from(organizations.values()).map((value) => structuredClone(value)),
      findByPrimaryOwnerUserId: async (userId: string) =>
        Array.from(organizations.values())
          .filter((o) => o.primaryOwnerUserId === userId)
          .map((o) => structuredClone(o)),
      updateOrganization: async (value: OrganizationRecord) => {
        organizations.set(value.organizationId, structuredClone(value));
      },
      lockOrganization: async () => undefined,
    },
    property: {
      createProperty: async (value: PropertyRecord) => {
        properties.set(value.propertyId, structuredClone(value));
      },
      findProperty: async (id: string) => structuredClone(properties.get(id)),
      findPropertiesByOrganization: async (id?: string) =>
        Array.from(properties.values())
          .filter((value) => !id || value.organizationId === id)
          .map((value) => structuredClone(value)),
      updateProperty: async (value: PropertyRecord) => {
        properties.set(value.propertyId, structuredClone(value));
      },
      createRoom: async (value: RoomRecord) => {
        rooms.set(value.roomId, structuredClone(value));
      },
      findRoom: async (id: string) => structuredClone(rooms.get(id)),
      findRoomsByProperty: async (id: string) =>
        Array.from(rooms.values())
          .filter((value) => value.propertyId === id)
          .map((value) => structuredClone(value)),
      updateRoom: async (value: RoomRecord) => {
        rooms.set(value.roomId, structuredClone(value));
      },
      lockProperty: async () => undefined,
      lockRoom: async () => undefined,
    },
    listing: {
      createListing: async (value: ListingRecord) => {
        listings.set(value.listingId, structuredClone(value));
      },
      findListing: async (id: string) => structuredClone(listings.get(id)),
      findCurrentListingByRoom: async (roomId: string) =>
        structuredClone(
          Array.from(listings.values()).find(
            (value) => value.roomId === roomId && value.status !== 'ARCHIVED',
          ),
        ),
      findListingsByRoom: async (roomId: string) =>
        Array.from(listings.values())
          .filter((value) => value.roomId === roomId)
          .map((value) => structuredClone(value)),
      findPublishedListings: async () =>
        Array.from(listings.values())
          .filter((value) => value.status === 'PUBLISHED')
          .map((value) => structuredClone(value)),
      updateListing: async (value: ListingRecord) => {
        listings.set(value.listingId, structuredClone(value));
      },
      insertStatusEvent: async (value: ListingStatusEventRecord) => {
        listingEvents.push(structuredClone(value));
      },
      findStatusEvents: async (id: string) =>
        listingEvents
          .filter((value) => value.listingId === id)
          .map((value) => structuredClone(value)),
      createInquiry: async (value: InquiryRecord) => {
        inquiries.set(value.inquiryId, structuredClone(value));
      },
      findInquiry: async (id: string) => structuredClone(inquiries.get(id)),
      findInquiriesByListing: async (id: string) =>
        Array.from(inquiries.values())
          .filter((value) => value.listingId === id)
          .map((value) => structuredClone(value)),
    },
    tenancy: {
      createTenancy: async (value: TenancyRecord) => {
        tenancies.set(value.tenancyId, structuredClone(value));
      },
      findTenancy: async (id: string) =>
        structuredClone(
          tenancies.get(id) ??
            (['tenancy-a', 'tenancy-b', 'ten_1', 'tenancy_reference'].includes(id)
              ? {
                  tenancyId: id,
                  roomId: `room-${id}`,
                  status: 'ACTIVE',
                  startedAt: null,
                  endedAt: null,
                  endReason: null,
                }
              : undefined),
        ),
      findTenanciesByRoom: async (roomId?: string) =>
        Array.from(tenancies.values())
          .filter((value) => !roomId || value.roomId === roomId)
          .map((value) => structuredClone(value)),
      findNonterminalByRoom: async (roomId: string) =>
        Array.from(tenancies.values())
          .filter(
            (value) =>
              value.roomId === roomId && ['DRAFT', 'ACTIVE', 'ENDING'].includes(value.status),
          )
          .map((value) => structuredClone(value)),
      updateTenancy: async (value: TenancyRecord) => {
        tenancies.set(value.tenancyId, structuredClone(value));
      },
      lockTenancy: async () => undefined,
      insertParticipant: async (value: TenancyParticipantRecord) => {
        participants.set(value.tenancyParticipantId, structuredClone(value));
      },
      findParticipant: async (id: string) => structuredClone(participants.get(id)),
      findParticipantsByUser: async (userId: string) =>
        Array.from(participants.values())
          .filter((value) => value.userId === userId)
          .map((value) => structuredClone(value)),
      findParticipantsByTenancy: async (tenancyId: string) =>
        Array.from(participants.values())
          .filter((value) => value.tenancyId === tenancyId)
          .map((value) => structuredClone(value)),
      findActivePrimary: async (tenancyId: string) =>
        structuredClone(
          Array.from(participants.values()).find(
            (value) => value.tenancyId === tenancyId && value.role === 'PRIMARY' && !value.leftAt,
          ),
        ),
      updateParticipant: async (value: TenancyParticipantRecord) => {
        participants.set(value.tenancyParticipantId, structuredClone(value));
      },
      insertTerms: async (value: TenancyTermsRecord) => {
        terms.set(value.tenancyTermsId, structuredClone(value));
      },
      findTermsVersion: async (tenancyId: string, version: number) =>
        structuredClone(
          Array.from(terms.values()).find(
            (value) => value.tenancyId === tenancyId && value.version === version,
          ),
        ),
      findTermsById: async (id: string) =>
        structuredClone(
          terms.get(id) ??
            (/^(terms-(1|a|b|reference)|terms_1)$/.test(id)
              ? {
                  tenancyTermsId: id,
                  tenancyId:
                    id === 'terms-b'
                      ? 'tenancy-b'
                      : id === 'terms_1'
                        ? 'ten_1'
                        : id === 'terms-reference'
                          ? 'tenancy_reference'
                          : 'tenancy-a',
                  version: 1,
                  rentAmount: '1.00',
                  agreedDepositRequirement: '1.00',
                  termStart: '2026-01-01',
                  termEnd: '2100-01-01',
                  billingDayOrDueDateRule: {},
                  electricityArrangement: {},
                  waterArrangement: {},
                  minimalRentalConditions: {},
                  effectiveFromCycleBoundary: '2026-01-01',
                }
              : undefined),
        ),
      findTermsByTenancy: async (tenancyId: string) =>
        Array.from(terms.values())
          .filter((value) => value.tenancyId === tenancyId)
          .sort((a, b) => a.version - b.version)
          .map((value) => structuredClone(value)),
      insertAcknowledgement: async (value: TermsAcknowledgementRecord) => {
        acknowledgements.set(value.termsAcknowledgementId, structuredClone(value));
      },
      findAcknowledgementsByTerms: async (termsId: string) =>
        Array.from(acknowledgements.values())
          .filter((value) => value.tenancyTermsId === termsId)
          .map((value) => structuredClone(value)),
      insertNotice: async (value: TenancyNoticeRecord) => {
        notices.set(value.tenancyNoticeId, structuredClone(value));
      },
      findNotice: async (id: string) => structuredClone(notices.get(id)),
      findNoticesByTenancy: async (tenancyId: string) =>
        Array.from(notices.values())
          .filter((value) => value.tenancyId === tenancyId)
          .map((value) => structuredClone(value)),
      updateNotice: async (value: TenancyNoticeRecord) => {
        notices.set(value.tenancyNoticeId, structuredClone(value));
      },
    },
    finance: {
      insertBillingCycle: async (v: BillingCycleRecord) => {
        cycles.set(v.billingCycleId, structuredClone(v));
      },
      findBillingCycle: async (id: string) => structuredClone(cycles.get(id)),
      findBillingCyclesForTenancy: async (id?: string) =>
        Array.from(cycles.values())
          .filter((v) => !id || v.tenancyId === id)
          .map((v) => structuredClone(v)),
      insertCharge: async (v: ChargeRecord) => {
        charges.set(v.chargeId, structuredClone(v));
      },
      findCharge: async (id: string) => structuredClone(charges.get(id)),
      findChargesForCycle: async (id: string) =>
        Array.from(charges.values())
          .filter((v) => v.billingCycleId === id)
          .map((v) => structuredClone(v)),
      insertPayment: async (v: PaymentRecord) => {
        payments.set(v.paymentId, structuredClone(v));
      },
      findPayment: async (id: string) => structuredClone(payments.get(id)),
      findPaymentsForTenancy: async (tenancyId: string) =>
        [...payments.values()]
          .filter((v) => v.tenancyId === tenancyId)
          .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt) || a.paymentId.localeCompare(b.paymentId))
          .map((v) => structuredClone(v)),
      updatePayment: async (v: PaymentRecord) => {
        payments.set(v.paymentId, structuredClone(v));
      },
      lockPayment: async () => undefined,
      insertPaymentAllocation: async (v: PaymentAllocationRecord) => {
        allocations.set(v.paymentAllocationId, structuredClone(v));
      },
      findPaymentAllocations: async (id: string) =>
        Array.from(allocations.values()).filter((v) => v.paymentId === id),
      sumPaymentCommittedAmount: async (id: string) => {
        const n =
          [...allocations.values()]
            .filter((v) => v.paymentId === id)
            .reduce((s, v) => s + Number(v.allocatedAmount), 0) +
          [...applications.values()]
            .filter((v) => v.paymentId === id)
            .reduce((s, v) => s + Number(v.appliedAmount), 0);
        return n.toFixed(2);
      },
      paymentHasCapacity: async (id: string, a: string) =>
        Number(payments.get(id)?.amount ?? 0) >=
        Number(a) +
          [...allocations.values()]
            .filter((v) => v.paymentId === id)
            .reduce((s, v) => s + Number(v.allocatedAmount), 0) +
          [...applications.values()]
            .filter((v) => v.paymentId === id)
            .reduce((s, v) => s + Number(v.appliedAmount), 0),
      insertDeposit: async (v: DepositRecord) => {
        deposits.set(v.depositId, v);
      },
      findDeposit: async (id: string) => deposits.get(id),
      findDepositForTenancy: async (id: string) =>
        [...deposits.values()].find((v) => v.tenancyId === id),
      lockDeposit: async () => undefined,
      insertDepositPaymentApplication: async (v: DepositPaymentApplicationRecord) => {
        applications.set(v.depositPaymentApplicationId, v);
      },
      findDepositPaymentApplications: async (id: string) =>
        [...applications.values()].filter((v) => v.depositId === id),
      sumDepositFundedAmount: async (id: string) =>
        [...applications.values()]
          .filter((v) => v.depositId === id)
          .reduce((s, v) => s + Number(v.appliedAmount), 0)
          .toFixed(2),
      insertDepositSettlement: async (v: DepositSettlementRecord) => {
        settlements.set(v.depositSettlementId, v);
      },
      findDepositSettlements: async (id: string) =>
        [...settlements.values()].filter((v) => v.depositId === id),
      sumDepositSettledAmount: async (id: string) =>
        [...settlements.values()]
          .filter((v) => v.depositId === id)
          .reduce((s, v) => s + Number(v.refundedAmount) + Number(v.retainedAmount), 0)
          .toFixed(2),
      depositHasCapacity: async (id: string, r: string, t: string) =>
        [...applications.values()]
          .filter((v) => v.depositId === id)
          .reduce((s, v) => s + Number(v.appliedAmount), 0) >=
        [...settlements.values()]
          .filter((v) => v.depositId === id)
          .reduce((s, v) => s + Number(v.refundedAmount) + Number(v.retainedAmount), 0) +
          Number(r) +
          Number(t),
      insertDepositEvent: async (v: DepositEventRecord) => {
        depositEvents.set(v.depositEventId, v);
      },
      findDepositEvents: async (id: string) =>
        [...depositEvents.values()].filter((v) => v.depositId === id),
      insertReceipt: async (v: ReceiptRecord) => {
        receipts.set(v.receiptId, v);
      },
      findReceipt: async (id: string) => receipts.get(id),
      findReceiptsForPayment: async (id?: string) =>
        [...receipts.values()].filter((v) => !id || v.paymentId === id),
      updateReceipt: async (v: ReceiptRecord) => {
        receipts.set(v.receiptId, v);
      },
      insertGatewayCheckout: async (v: GatewayCheckoutRecord) => {
        checkouts.set(v.checkoutId, structuredClone(v));
      },
      findGatewayCheckout: async (id: string) => structuredClone(checkouts.get(id)),
      findGatewayCheckoutByOrderId: async (orderId: string) =>
        structuredClone([...checkouts.values()].find((v) => v.providerOrderId === orderId)),
      lockGatewayCheckout: async () => undefined,
      updateGatewayCheckout: async (v: GatewayCheckoutRecord) => {
        checkouts.set(v.checkoutId, structuredClone(v));
      },
    },
    incident: {
      createIncident: async (v: IncidentRecord) => {
        incidents.set(v.incidentId, structuredClone(v));
      },
      findIncident: async (id: string) => structuredClone(incidents.get(id)),
      findIncidents: async (roomId?: string) =>
        [...incidents.values()]
          .filter((v) => !roomId || v.roomId === roomId)
          .map((v) => structuredClone(v)),
      findOpenIncidentsByRoom: async (id: string) =>
        [...incidents.values()].filter(
          (v) => v.roomId === id && !['CLOSED', 'REJECTED'].includes(v.status),
        ),
      updateIncident: async (v: IncidentRecord) => {
        incidents.set(v.incidentId, structuredClone(v));
      },
      insertIncidentEvent: async (v: IncidentEventRecord) => {
        incidentEvents.push(structuredClone(v));
      },
      findIncidentEvents: async (id: string) =>
        incidentEvents.filter((v) => v.incidentId === id).map((v) => structuredClone(v)),
    },
    trust: {
      createTrustReport: async (v: TrustReportRecord) => {
        trustReports.set(v.trustReportId, structuredClone(v));
      },
      findTrustReport: async (id: string) => structuredClone(trustReports.get(id)),
      findTrustReports: async () => [...trustReports.values()].map((v) => structuredClone(v)),
      updateTrustReport: async (v: TrustReportRecord) => {
        trustReports.set(v.trustReportId, structuredClone(v));
      },
    },
    notification: {
      createNotification: async (v: NotificationRecord) => {
        notifications.set(v.notificationId, structuredClone(v));
      },
      findNotification: async (id: string) => structuredClone(notifications.get(id)),
      findNotificationsByRecipient: async (userId: string) =>
        [...notifications.values()]
          .filter((v) => v.recipientUserId === userId)
          .map((v) => structuredClone(v)),
      updateNotification: async (v: NotificationRecord) => {
        notifications.set(v.notificationId, structuredClone(v));
      },
    },
  };
  return {
    run: async (work) =>
      work({ repositories: repositories as never, afterCommit: () => undefined }),
  };
}

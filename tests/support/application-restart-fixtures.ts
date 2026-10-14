import type { BillingService } from '../../src/modules/billing/services/billing.service';
import type { InquiryService } from '../../src/modules/listing/services/inquiry.service';
import type { ListingService } from '../../src/modules/listing/services/listing.service';
import type { TenancyParticipantService } from '../../src/modules/tenancy/services/tenancy-participant.service';
import type { TenancyNoticeService } from '../../src/modules/tenancy/services/tenancy-notice.service';
import type { IncidentService } from '../../src/modules/incident/services/incident.service';
import type { AuditTrustService } from '../../src/modules/audit-trust/services/audit-trust.service';
import type { DepositEventRecord } from '../../src/persistence/ports/finance.repository';
import type { IncidentEventRecord } from '../../src/persistence/ports/incident.repository';
import { loadFixture } from './fixture-loader';

interface ApplicationRestartFixture {
  version: 1;
  provenance: string;
  expected: {
    initialOutstanding: string;
    remainingOutstanding: string;
    paymentVerification: 'USER_RECORDED';
    tenancyStatusAfterActivation: 'active';
    listingStatusAfterActivation: 'unpublished';
  };
  actors: {
    ownerToken: string;
    ownerSubject: string;
    tenantToken: string;
    tenantSubject: string;
    outsiderToken: string;
    outsiderSubject: string;
  };
  values: {
    propertyId: string;
    roomId: string;
    listingId: string;
    organizationName: string;
    propertyName: string;
    operationalAddress: string;
    operationalLocation: { longitude: number; latitude: number };
    propertyPublicLocation: { longitude: number; latitude: number };
    roomLabel: string;
    listingTitle: string;
    listingDescription: string;
    listingPrice: string;
    listingPublicLocation: { longitude: number; latitude: number };
    inquiryMessage: string;
    inquiryStatus: Parameters<InquiryService['create']>[0]['status'];
    participantRole: Parameters<TenancyParticipantService['add']>[0]['role'];
    activeAssetManagementStatus: 'ACTIVE';
    tenancyActivatedAt: string;
    joinedAt: string;
    termsVersion: number;
    rentAmount: string;
    depositRequirement: string;
    termStart: string;
    termEnd: string;
    billingDayRule: { day: number };
    electricityArrangement: { mode: string };
    waterArrangement: { mode: string };
    rentalConditions: { occupants: number };
    effectiveBoundary: string;
    acknowledgedAt: string;
    noticeType: Parameters<TenancyNoticeService['issue']>[0]['noticeType'];
    noticeContent: string;
    noticeIssuedAt: string;
    cycleStart: string;
    cycleEnd: string;
    charges: Parameters<BillingService['createCycle']>[0]['charges'];
    paymentAmount: string;
    paymentSource: Parameters<BillingService['recordPayment']>[0]['source'];
    paymentConfirmedAt: string;
    billingAllocationAmount: string;
    depositApplicationAmount: string;
    incidentCategory: Parameters<IncidentService['create']>[0]['category'];
    acknowledgedIncidentStatus: Parameters<IncidentService['updateStatus']>[1]['status'];
    unauthorizedIncidentUpdate: Parameters<IncidentService['updateStatus']>[1];
    expectedIncidentStatusBeforeRestart: Parameters<IncidentService['updateStatus']>[1]['status'];
    publishedListingStatus: Parameters<ListingService['transition']>[1];
    publishReason: Parameters<ListingService['transition']>[2]['reasonCode'];
    publishActorType: Parameters<ListingService['transition']>[2]['actorType'];
    publishTrigger: Parameters<ListingService['transition']>[2]['trigger'];
    trustReportReason: Parameters<AuditTrustService['submitReport']>[0]['reason'];
    expectedDepositEvents: DepositEventRecord['eventType'][];
    expectedIncidentStatusAfterRestart: Parameters<IncidentService['updateStatus']>[1]['status'];
    expectedIncidentEvents: IncidentEventRecord['toStatus'][];
    expectedTrustReportCount: number;
  };
}
export const applicationRestartFixture = loadFixture<ApplicationRestartFixture>(
  'payment/application-restart',
);

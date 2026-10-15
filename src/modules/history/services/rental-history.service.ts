import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { BillingService } from '../../billing/services/billing.service';
import { IncidentService } from '../../incident/services/incident.service';
import { ListingService } from '../../listing/services/listing.service';
import { ReceiptService } from '../../receipt/services/receipt.service';
import { RoomService } from '../../room/services/room.service';
import { TenancyNoticeService } from '../../tenancy/services/tenancy-notice.service';
import { TenancyTermsService } from '../../tenancy/services/tenancy-terms.service';
import { TenancyService } from '../../tenancy/services/tenancy.service';
import type {
  RentalDepositHistory,
  RentalHistoryProjection,
  RentalIncidentHistoryEntry,
  RentalPaymentHistoryEntry,
  RoomOperationalHistoryProjection,
} from '../contracts';

@Injectable()
export class RentalHistoryService {
  constructor(
    @Inject(TenancyService) private readonly tenancies: TenancyService,
    @Inject(TenancyTermsService) private readonly terms: TenancyTermsService,
    @Inject(BillingService) private readonly billing: BillingService,
    @Inject(ReceiptService) private readonly receipts: ReceiptService,
    @Inject(TenancyNoticeService) private readonly notices: TenancyNoticeService,
    @Inject(IncidentService) private readonly incidents: IncidentService,
    @Inject(RoomService) private readonly rooms: RoomService,
    @Inject(ListingService) private readonly listings: ListingService,
  ) {}

  async forTenancy(tenancyId: string): Promise<RentalHistoryProjection> {
    const tenancy = await this.tenancies.findById(tenancyId);
    const [terms, notices, roomIncidents, payments, deposit] = await Promise.all([
      this.terms.listByTenancyId(tenancyId),
      this.notices.listByTenancyId(tenancyId),
      this.incidents.findByRoomId(tenancy.roomId),
      this.paymentHistory(tenancyId),
      this.depositHistory(tenancyId),
    ]);

    const tenancyIncidents = roomIncidents
      .filter((incident) => this.inOccupancyWindow(incident.createdAt, tenancy.startedAt, tenancy.endedAt))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

    return {
      tenancy,
      terms: [...terms].sort((a, b) => a.version - b.version),
      payments,
      notices: [...notices].sort(
        (a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id),
      ),
      incidents: await this.incidentHistory(tenancyIncidents.map((incident) => incident.id)),
      deposit,
    };
  }

  async forRoom(roomId: string): Promise<RoomOperationalHistoryProjection> {
    const room = await this.rooms.findById(roomId);
    const [listings, tenancies, incidents] = await Promise.all([
      this.listings.findByRoomId(roomId),
      this.tenancies.findByRoomId(roomId),
      this.incidents.findByRoomId(roomId),
    ]);

    const listingHistory = await Promise.all(
      [...listings]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(async (listing) => ({
          listing,
          events: (await this.listings.listStatusEvents(listing.id)).sort(
            (a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
          ),
        })),
    );

    const tenancyHistory = await Promise.all(
      [...tenancies]
        .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? '') || a.id.localeCompare(b.id))
        .map(async (tenancy) => ({
          tenancy,
          billingCycles: (await this.billing.findByTenancyId(tenancy.id)).sort(
            (a, b) => a.periodStart.localeCompare(b.periodStart) || a.id.localeCompare(b.id),
          ),
          payments: await this.paymentHistory(tenancy.id),
          deposit: await this.depositHistory(tenancy.id),
        })),
    );

    return {
      room,
      listings: listingHistory,
      tenancies: tenancyHistory,
      incidents: await this.incidentHistory(
        [...incidents]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
          .map((incident) => incident.id),
      ),
    };
  }

  private async paymentHistory(tenancyId: string): Promise<RentalPaymentHistoryEntry[]> {
    const payments = await this.billing.findPaymentsByTenancyId(tenancyId);
    return Promise.all(
      payments.map(async (payment) => ({
        payment,
        receipts: (await this.receipts.findByPaymentId(payment.id)).sort(
          (a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id),
        ),
      })),
    );
  }

  private async depositHistory(tenancyId: string): Promise<RentalDepositHistory | null> {
    try {
      const projection = await this.billing.findDepositProjectionForTenancy(tenancyId);
      return {
        projection,
        events: (await this.billing.listDepositEvents(projection.id)).sort(
          (a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
        ),
      };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  private async incidentHistory(incidentIds: string[]): Promise<RentalIncidentHistoryEntry[]> {
    return Promise.all(
      incidentIds.map(async (incidentId) => ({
        incident: await this.incidents.findById(incidentId),
        events: (await this.incidents.listEvents(incidentId)).sort(
          (a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
        ),
      })),
    );
  }

  private inOccupancyWindow(createdAt: string, startedAt?: string, endedAt?: string): boolean {
    if (!startedAt) return false;
    if (createdAt < startedAt) return false;
    return !endedAt || createdAt <= endedAt;
  }
}

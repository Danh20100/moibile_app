import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { TrustReportRecord } from '../../../persistence/ports/trust.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { AuditRecord, TrustReport } from '../contracts';
import { QueryAuditDto, RecordAuditFactDto, SubmitTrustReportDto } from '../dto';

const TRUST_NOTE_MAX_CODE_POINTS = 2000;

@Injectable()
export class AuditTrustService {
  // Technical diagnostic facts are intentionally process-local: the frozen schema has no audit-log table.
  // They are not business authority and current-core correctness never depends on them.
  private readonly diagnosticRecords: AuditRecord[] = [];
  constructor(@Inject(TRANSACTION_MANAGER) private readonly tx: TransactionManager) {}
  async recordFact(dto: RecordAuditFactDto): Promise<AuditRecord> {
    const value: AuditRecord = {
      id: randomUUID(),
      ...dto,
      metadata: dto.metadata ? structuredClone(dto.metadata) : undefined,
      timestamp: new Date().toISOString(),
    };
    this.diagnosticRecords.push(value);
    return structuredClone(value);
  }
  async queryAudit(q: QueryAuditDto): Promise<AuditRecord[]> {
    return this.diagnosticRecords
      .filter((x) => (!q.resourceType || x.resourceType === q.resourceType) && (!q.resourceId || x.resourceId === q.resourceId))
      .map((x) => structuredClone(x));
  }
  async submitReport(input: SubmitTrustReportDto, userId: string): Promise<TrustReport> {
    if (!userId.trim()) throw new BadRequestException('Verified reporter is required');
    if (Boolean(input.listingId) === Boolean(input.reviewId)) {
      throw new BadRequestException('TrustReport target must be exactly one Listing or Review');
    }
    if (input.reviewId) {
      throw new UnprocessableEntityException('Review reports are not accepted in V1');
    }
    if (input.note !== undefined && Array.from(input.note).length > TRUST_NOTE_MAX_CODE_POINTS) {
      throw new BadRequestException('Trust report note exceeds 2000 Unicode code points');
    }
    const listingId = input.listingId!;
    const value: TrustReport = {
      id: randomUUID(),
      reporterUserId: userId,
      listingId,
      reason: input.reason,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
      ...(input.note ? { noteOrEvidenceReference: input.note } : {}),
    };
    await this.tx.run(async ({ repositories }) => {
      await repositories.listing.lockListing(listingId);
      const listing = await repositories.listing.findListing(listingId);
      if (!listing || listing.status.toUpperCase() !== 'PUBLISHED') {
        throw new NotFoundException('Public Listing target was not found');
      }
      await repositories.trust.createTrustReport(this.toRecord(value));
    });
    return value;
  }
  async listReports(): Promise<TrustReport[]> {
    throw new ForbiddenException('Trust report list is not available to app users');
  }
  private toRecord(x: TrustReport): TrustReportRecord {
    return {
      trustReportId: x.id,
      reporterUserId: x.reporterUserId ?? null,
      listingId: x.listingId ?? null,
      reviewId: x.reviewId ?? null,
      reason: x.reason,
      status: x.status,
      noteOrEvidenceReference: x.noteOrEvidenceReference ?? null,
      createdAt: x.createdAt,
      resolvedAt: x.resolvedAt ?? null,
    };
  }
}

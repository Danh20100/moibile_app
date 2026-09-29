import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditRecord, TrustReport } from '../contracts';
import { QueryAuditDto, RecordAuditFactDto, SubmitInternalReportDto } from '../dto';
@Injectable()
export class AuditTrustService {
  private readonly records: AuditRecord[] = [];
  private readonly reports = new Map<string, TrustReport>();
  async recordFact(dto: RecordAuditFactDto): Promise<AuditRecord> { const value: AuditRecord = { id: randomUUID(), ...dto, metadata: dto.metadata ? structuredClone(dto.metadata) : undefined, timestamp: new Date().toISOString() }; this.records.push(value); return structuredClone(value); }
  async queryAudit(query: QueryAuditDto): Promise<AuditRecord[]> { return this.records.filter((value) => (!query.resourceType || value.resourceType === query.resourceType) && (!query.resourceId || value.resourceId === query.resourceId)).map((value) => structuredClone(value)); }
  async submitReport(dto: SubmitInternalReportDto): Promise<TrustReport> {
    if (Boolean(dto.listingId) === Boolean(dto.reviewId)) throw new BadRequestException('TrustReport target must be exactly one Listing or Review');
    const value: TrustReport = { id: randomUUID(), ...dto, status: 'SUBMITTED', createdAt: new Date().toISOString() };
    this.reports.set(value.id, structuredClone(value)); return structuredClone(value);
  }
  async listReports(): Promise<TrustReport[]> { return Array.from(this.reports.values()).map((value) => structuredClone(value)); }
}

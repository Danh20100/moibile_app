import { Injectable } from '@nestjs/common';

import { AuditRecord, InternalReport } from '../contracts';
import { QueryAuditDto, RecordAuditFactDto, SubmitInternalReportDto } from '../dto';

@Injectable()
export class AuditTrustService {
  private readonly records: AuditRecord[] = [];
  private readonly reports = new Map<string, InternalReport>();

  async recordFact(dto: RecordAuditFactDto): Promise<AuditRecord> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: AuditRecord = {
      id,
      actorId: dto.actorId,
      action: dto.action,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      metadata: dto.metadata,
      timestamp: new Date().toISOString(),
    };
    this.records.push(record);
    return record;
  }

  async queryAudit(query: QueryAuditDto): Promise<AuditRecord[]> {
    return this.records.filter((r) => {
      if (query.resourceType && r.resourceType !== query.resourceType) {
        return false;
      }
      if (query.resourceId && r.resourceId !== query.resourceId) {
        return false;
      }
      return true;
    });
  }

  async submitReport(dto: SubmitInternalReportDto): Promise<InternalReport> {
    const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const report: InternalReport = {
      id,
      reporterId: dto.reporterId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
      details: dto.details,
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };
    this.reports.set(id, report);
    return report;
  }

  async listReports(): Promise<InternalReport[]> {
    return Array.from(this.reports.values());
  }
}

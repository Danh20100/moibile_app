export interface AuditRecord {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export type InternalReportStatus = 'submitted' | 'under_review' | 'resolved' | 'dismissed';

export interface InternalReport {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
  status: InternalReportStatus;
  createdAt: string;
  updatedAt: string;
}

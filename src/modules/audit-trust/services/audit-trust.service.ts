import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { TrustReportRecord } from '../../../persistence/ports/trust.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { AuditRecord, TrustReport } from '../contracts';
import { QueryAuditDto, RecordAuditFactDto, SubmitInternalReportDto } from '../dto';

@Injectable()
export class AuditTrustService {
  // Technical diagnostic facts are intentionally process-local: the frozen schema has no audit-log table.
  // They are not business authority and current-core correctness never depends on them.
  private readonly diagnosticRecords:AuditRecord[]=[];
  constructor(@Inject(TRANSACTION_MANAGER) private readonly tx:TransactionManager){}
  async recordFact(dto:RecordAuditFactDto):Promise<AuditRecord>{const value:AuditRecord={id:randomUUID(),...dto,metadata:dto.metadata?structuredClone(dto.metadata):undefined,timestamp:new Date().toISOString()};this.diagnosticRecords.push(value);return structuredClone(value);}
  async queryAudit(q:QueryAuditDto):Promise<AuditRecord[]>{return this.diagnosticRecords.filter(x=>(!q.resourceType||x.resourceType===q.resourceType)&&(!q.resourceId||x.resourceId===q.resourceId)).map(x=>structuredClone(x));}
  async submitReport(dto:SubmitInternalReportDto):Promise<TrustReport>{
    if(Boolean(dto.listingId)===Boolean(dto.reviewId))throw new BadRequestException('TrustReport target must be exactly one Listing or Review');
    const value:TrustReport={id:randomUUID(),...dto,status:'SUBMITTED',createdAt:new Date().toISOString()};
    await this.tx.run(async({repositories})=>{
      await repositories.trust.createTrustReport(this.toRecord(value));
      if (repositories.notification && dto.listingId) {
        const listing = await repositories.listing?.findListing(dto.listingId);
        if (listing) {
          const room = await repositories.property?.findRoom(listing.roomId);
          if (room) {
            const prop = await repositories.property?.findProperty(room.propertyId);
            if (prop) {
              const org = await repositories.organization?.findOrganization(prop.organizationId);
              if (org?.primaryOwnerUserId) {
                await repositories.notification.createNotification({
                  notificationId: randomUUID(),
                  recipientUserId: org.primaryOwnerUserId,
                  category: 'REVIEW_OR_REPORT_MODERATION',
                  messageOrPayloadReference: `trust_report:${value.id}`,
                  deliveryStatus: 'PENDING',
                  createdAt: value.createdAt,
                  deliveredAt: null,
                  readAt: null,
                });
              }
            }
          }
        }
      }
    });
    return value;
  }
  async listReports():Promise<TrustReport[]>{return(await this.tx.run(({repositories})=>repositories.trust.findTrustReports())).map(x=>this.fromRecord(x));}
  private toRecord(x:TrustReport):TrustReportRecord{return{trustReportId:x.id,reporterUserId:x.reporterUserId??null,listingId:x.listingId??null,reviewId:x.reviewId??null,reason:x.reason,status:x.status,noteOrEvidenceReference:x.noteOrEvidenceReference??null,createdAt:x.createdAt,resolvedAt:x.resolvedAt??null};}
  private fromRecord(x:TrustReportRecord):TrustReport{return{id:x.trustReportId,reason:x.reason as TrustReport['reason'],status:x.status as TrustReport['status'],createdAt:x.createdAt,...(x.reporterUserId?{reporterUserId:x.reporterUserId}:{}),...(x.listingId?{listingId:x.listingId}:{}),...(x.reviewId?{reviewId:x.reviewId}:{}),...(x.noteOrEvidenceReference?{noteOrEvidenceReference:x.noteOrEvidenceReference}:{}),...(x.resolvedAt?{resolvedAt:x.resolvedAt}:{})};}
}

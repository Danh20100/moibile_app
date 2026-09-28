import type { TimestampString } from './repositories';
export interface IncidentRecord { incidentId:string; roomId:string; reportedByUserId:string|null; category:string; status:string; closureReason:string|null; createdAt:TimestampString; closedAt:TimestampString|null }
export interface IncidentEventRecord { incidentEventId:string; incidentId:string; eventType:string; actorUserId:string|null; note:string|null; attachmentReference:string|null; fromStatus:string|null; toStatus:string|null; occurredAt:TimestampString }
export interface IncidentRepository {
  createIncident(input:IncidentRecord):Promise<void>; findIncident(id:string):Promise<IncidentRecord|undefined>;
  findOpenIncidentsByRoom(roomId:string):Promise<IncidentRecord[]>; updateIncident(input:IncidentRecord):Promise<void>;
  insertIncidentEvent(input:IncidentEventRecord):Promise<void>; findIncidentEvents(incidentId:string):Promise<IncidentEventRecord[]>;
}

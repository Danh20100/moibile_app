import {sql,type Kysely,type Transaction} from 'kysely';
import type {IncidentEventRecord,IncidentRecord,IncidentRepository} from '../../../persistence/ports/incident.repository';
import {mapPostgresError} from '../postgres-error.mapper'; import type {Database} from '../schema.types';
export class PostgresIncidentRepository implements IncidentRepository {
 constructor(private readonly db:Kysely<Database>|Transaction<Database>){}
 private async run<T>(f:()=>Promise<T>){try{return await f();}catch(e){throw mapPostgresError(e);}}
 private values(x:IncidentRecord){return{incident_id:x.incidentId,room_id:x.roomId,reported_by_user_id:x.reportedByUserId,category:x.category,status:x.status,closure_reason:x.closureReason,created_at:x.createdAt,closed_at:x.closedAt};}
 async createIncident(x:IncidentRecord){await this.run(async()=>{await this.db.insertInto('incidents').values(this.values(x)).execute();});}
 async updateIncident(x:IncidentRecord){const{incident_id:_,...v}=this.values(x);await this.run(async()=>{await this.db.updateTable('incidents').set(v).where('incident_id','=',x.incidentId).execute();});}
 private async incidents(q:ReturnType<typeof sql<IncidentRecord>>){return this.run(async()=>[...(await q.execute(this.db)).rows]);}
 async findIncident(id:string){return (await this.incidents(sql`SELECT incident_id AS "incidentId",room_id AS "roomId",reported_by_user_id AS "reportedByUserId",category,status,closure_reason AS "closureReason",created_at AS "createdAt",closed_at AS "closedAt" FROM incidents WHERE incident_id=${id}`))[0];}
 findOpenIncidentsByRoom(id:string){return this.incidents(sql`SELECT incident_id AS "incidentId",room_id AS "roomId",reported_by_user_id AS "reportedByUserId",category,status,closure_reason AS "closureReason",created_at AS "createdAt",closed_at AS "closedAt" FROM incidents WHERE room_id=${id} AND status NOT IN ('CLOSED','REJECTED') ORDER BY created_at,incident_id`);}
 async insertIncidentEvent(x:IncidentEventRecord){await this.run(async()=>{await this.db.insertInto('incident_events').values({incident_event_id:x.incidentEventId,incident_id:x.incidentId,event_type:x.eventType,actor_user_id:x.actorUserId,note:x.note,attachment_reference:x.attachmentReference,from_status:x.fromStatus,to_status:x.toStatus,occurred_at:x.occurredAt}).execute();});}
 async findIncidentEvents(id:string){return this.run(async()=>[...(await sql<IncidentEventRecord>`SELECT incident_event_id AS "incidentEventId",incident_id AS "incidentId",event_type AS "eventType",actor_user_id AS "actorUserId",note,attachment_reference AS "attachmentReference",from_status AS "fromStatus",to_status AS "toStatus",occurred_at AS "occurredAt" FROM incident_events WHERE incident_id=${id} ORDER BY occurred_at,incident_event_id`.execute(this.db)).rows]);}
}

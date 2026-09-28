import type { TimestampString } from './repositories';

export interface IncidentRecord {
  incident_id: string; room_id: string; reported_by_user_id: string | null;
  category: string; status: string; closure_reason: string | null;
  created_at: TimestampString; closed_at: TimestampString | null;
}
export interface IncidentEventRecord {
  incident_event_id: string; incident_id: string; event_type: string; actor_user_id: string | null;
  note: string | null; attachment_reference: string | null; from_status: string | null;
  to_status: string | null; occurred_at: TimestampString;
}
export interface CreateIncidentInput extends IncidentRecord {}
export interface CreateIncidentEventInput extends IncidentEventRecord {}
export interface IncidentRepository {
  createIncident(input: CreateIncidentInput): Promise<void>;
  findIncident(incidentId: string): Promise<IncidentRecord | undefined>;
  findOpenIncidentsByRoom(roomId: string): Promise<IncidentRecord[]>;
  updateIncident(record: IncidentRecord): Promise<void>;
  insertIncidentEvent(input: CreateIncidentEventInput): Promise<void>;
  findIncidentEvents(incidentId: string): Promise<IncidentEventRecord[]>;
}

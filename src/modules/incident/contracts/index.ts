export type IncidentCategory = 'ELECTRICAL' | 'PLUMBING' | 'ACCESS_SECURITY' | 'ROOM_FACILITY' | 'APPLIANCE' | 'OTHER';
export type IncidentStatus = 'REPORTED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REJECTED';
export interface IncidentTicket { id: string; roomId: string; reportedByUserId?: string; category: IncidentCategory; status: IncidentStatus; closureReason?: string; createdAt: string; closedAt?: string; }
export interface IncidentEvent { id: string; incidentId: string; eventType: string; actorUserId?: string; note?: string; attachmentReference?: string; fromStatus?: IncidentStatus; toStatus?: IncidentStatus; occurredAt: string; }

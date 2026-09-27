export type IncidentStatus =
  'reported' | 'acknowledged' | 'processing' | 'need_more_information' | 'resolved' | 'closed';

export interface IncidentReference {
  incidentId: string;
}

export interface IncidentTicket {
  id: string;
  roomId: string;
  reporterId: string;
  title: string;
  description: string;
  category: string;
  status: IncidentStatus;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

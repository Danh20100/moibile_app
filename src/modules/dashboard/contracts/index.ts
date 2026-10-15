export type DashboardRoomState = 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';

export interface DashboardReadModel {
  organizationId: string;
  roomsByState: Record<DashboardRoomState, number>;
  activeTenancyCount: number;
  outstandingReceivable: string | null;
  confirmedPaymentTotal: string | null;
  openIncidentCount: number;
}

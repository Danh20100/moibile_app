import { Inject, Injectable } from '@nestjs/common';

import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import type { DashboardReadModel, DashboardRoomState } from '../contracts';

const OPEN_INCIDENT_STATES = new Set(['REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED']);

@Injectable()
export class DashboardService {
  constructor(
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: TransactionManager,
  ) {}

  async forOrganization(organizationId: string): Promise<DashboardReadModel> {
    return this.tx.run(async ({ repositories }) => {
      const roomsByState: Record<DashboardRoomState, number> = {
        VACANT: 0,
        OCCUPIED: 0,
        MAINTENANCE: 0,
        INACTIVE: 0,
      };
      let activeTenancyCount = 0;
      let openIncidentCount = 0;

      const properties = await repositories.property.findPropertiesByOrganization(organizationId);
      for (const property of properties.filter((item) => item.lifecycleStatus === 'ACTIVE')) {
        const rooms = await repositories.property.findRoomsByProperty(property.propertyId);
        for (const room of rooms) {
          if (room.recordLifecycle === 'ACTIVE' && room.operationalState in roomsByState) {
            roomsByState[room.operationalState as DashboardRoomState] += 1;
          }

          const tenancies = await repositories.tenancy.findTenanciesByRoom(room.roomId);
          activeTenancyCount += tenancies.filter((tenancy) => tenancy.status === 'ACTIVE').length;

          const incidents = await repositories.incident.findIncidents(room.roomId);
          openIncidentCount += incidents.filter((incident) =>
            OPEN_INCIDENT_STATES.has(incident.status),
          ).length;
        }
      }

      return {
        organizationId,
        roomsByState,
        activeTenancyCount,
        // Canonical freezes these Dashboard categories, but does not freeze the
        // aggregation time window and Charge over-allocation policy is still OPEN.
        // Returning null keeps the server authoritative without inventing policy.
        outstandingReceivable: null,
        confirmedPaymentTotal: null,
        openIncidentCount,
      };
    });
  }
}

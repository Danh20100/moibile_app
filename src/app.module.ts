import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthGuard, ResourceAuthorizationModule } from './common/index';
import { HealthController } from './health.controller';
import { AuditTrustModule } from './modules/audit-trust';
import { BillingModule } from './modules/billing';
import { DashboardModule } from './modules/dashboard';
import { IdentityAccessModule } from './modules/identity-access';
import { IncidentModule } from './modules/incident';
import { ListingModule } from './modules/listing';
import { OrganizationModule } from './modules/organization';
import { PropertyModule } from './modules/property';
import { ReceiptModule } from './modules/receipt';
import { RoomModule } from './modules/room';
import { RentalLifecycleModule } from './modules/rental-lifecycle';
import { TenancyModule } from './modules/tenancy';
import { NotificationModule } from './modules/notification';

@Module({
  imports: [
    ResourceAuthorizationModule,
    OrganizationModule,
    PropertyModule,
    RoomModule,
    TenancyModule,
    BillingModule,
    DashboardModule,
    ReceiptModule,
    IdentityAccessModule,
    IncidentModule,
    ListingModule,
    RentalLifecycleModule,
    AuditTrustModule,
    NotificationModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}

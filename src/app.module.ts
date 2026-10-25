import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthGuard, ResourceAuthorizationModule } from './common/index';
import { HealthController } from './health.controller';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AuditTrustModule } from './modules/audit-trust';
import { BillingModule } from './modules/billing';
import { DashboardModule } from './modules/dashboard';
import { HistoryModule } from './modules/history';
import { IdentityAccessModule } from './modules/identity-access';
import { IdentityVerificationModule } from './modules/identity-verification/identity-verification.module';
import { IncidentModule } from './modules/incident';
import { ListingModule } from './modules/listing';
import { OrganizationModule } from './modules/organization';
import { PropertyModule } from './modules/property';
import { ReceiptModule } from './modules/receipt';
import { RoomModule } from './modules/room';
import { RentalLifecycleModule } from './modules/rental-lifecycle';
import { TenancyModule } from './modules/tenancy';
import { NotificationModule } from './modules/notification';
import { PaymentGatewayModule } from './modules/payment-gateway';

@Module({
  imports: [
    MessagingModule,
    ResourceAuthorizationModule,
    OrganizationModule,
    PropertyModule,
    RoomModule,
    TenancyModule,
    BillingModule,
    DashboardModule,
    HistoryModule,
    ReceiptModule,
    IdentityAccessModule,
    IdentityVerificationModule,
    IncidentModule,
    ListingModule,
    RentalLifecycleModule,
    AuditTrustModule,
    NotificationModule,
    PaymentGatewayModule,
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

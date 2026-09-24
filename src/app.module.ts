import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { AuditTrustModule } from './modules/audit-trust';
import { BillingModule } from './modules/billing';
import { IdentityAccessModule } from './modules/identity-access';
import { IncidentModule } from './modules/incident';
import { ListingModule } from './modules/listing';
import { OnboardingModule } from './modules/onboarding';
import { OrganizationModule } from './modules/organization';
import { PropertyModule } from './modules/property';
import { ReceiptModule } from './modules/receipt';
import { RoomModule } from './modules/room';
import { SubscriptionModule } from './modules/subscription';
import { TenancyModule } from './modules/tenancy';

@Module({
  imports: [
    OrganizationModule,
    PropertyModule,
    RoomModule,
    TenancyModule,
    BillingModule,
    ReceiptModule,
    IdentityAccessModule,
    IncidentModule,
    ListingModule,
    OnboardingModule,
    SubscriptionModule,
    AuditTrustModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

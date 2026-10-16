import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { PaymentGatewayController } from './controllers/payment-gateway.controller';
import { HttpMomoPaymentClient, loadMomoConfig, MOMO_PAYMENT_CLIENT } from './momo/momo-client';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { GatewaySettlementService } from './services/gateway-settlement.service';
import { GatewayProviderRegistry } from './providers/gateway-provider.registry';
import { MomoGatewayAdapter } from './providers/momo-gateway.adapter';
import { DemoGatewayAdapter } from './providers/demo-gateway.adapter';
import { DemoPaymentController } from './controllers/demo-payment.controller';
import { SepayHandoffController } from './controllers/sepay-handoff.controller';
import { SlotCheckoutController } from './controllers/slot-checkout.controller';
import { SlotCheckoutService } from './services/slot-checkout.service';
import { DemoPaymentService } from './services/demo-payment.service';
import { SepayHandoffService } from './services/sepay-handoff.service';
import { SepayGatewayAdapter, SEPAY_PRODUCTION_CONFIG } from './providers/sepay-gateway.adapter';
import { HttpSepayOrderClient, SEPAY_ORDER_READER } from './sepay/sepay-order-client';
import {
  loadSepayProductionConfig,
  type SepayProductionConfig,
} from './sepay/sepay-production-config';

@Module({
  imports: [DatabaseModule, TenancyModule],
  controllers: [PaymentGatewayController, DemoPaymentController, SepayHandoffController, SlotCheckoutController],
  providers: [
    PaymentGatewayService,
    GatewaySettlementService,
    SlotCheckoutService,
    GatewayProviderRegistry,
    MomoGatewayAdapter,
    DemoGatewayAdapter,
    SepayGatewayAdapter,
    SepayHandoffService,
    DemoPaymentService,
    {
      provide: SEPAY_PRODUCTION_CONFIG,
      useFactory: (): SepayProductionConfig | null => loadSepayProductionConfig(process.env),
    },
    {
      provide: SEPAY_ORDER_READER,
      useFactory: (config: SepayProductionConfig | null) =>
        config
          ? new HttpSepayOrderClient(config)
          : { readInvoice: async () => ({ kind: 'uncertain' as const }) },
      inject: [SEPAY_PRODUCTION_CONFIG],
    },
    {
      provide: MOMO_PAYMENT_CLIENT,
      useFactory: () => new HttpMomoPaymentClient(loadMomoConfig(process.env)),
    },
  ],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}

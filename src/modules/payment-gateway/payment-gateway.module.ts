import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { PaymentGatewayController } from './controllers/payment-gateway.controller';
import { HttpMomoPaymentClient, loadMomoConfig, MOMO_PAYMENT_CLIENT } from './momo/momo-client';
import { PaymentGatewayService } from './services/payment-gateway.service';

@Module({
  imports: [DatabaseModule, TenancyModule],
  controllers: [PaymentGatewayController],
  providers: [
    PaymentGatewayService,
    {
      provide: MOMO_PAYMENT_CLIENT,
      useFactory: () => new HttpMomoPaymentClient(loadMomoConfig(process.env)),
    },
  ],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}

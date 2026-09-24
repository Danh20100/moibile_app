import { Module } from '@nestjs/common';

import { ReceiptController } from './controllers/receipt.controller';
import { ReceiptService } from './services/receipt.service';

@Module({
  controllers: [ReceiptController],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule {}

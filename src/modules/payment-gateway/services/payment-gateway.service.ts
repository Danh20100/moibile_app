import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { isNumeric18Scale2NonNegative, type DecimalString } from '../../../common/domain/decimal-string';
import type { GatewayCheckoutRecord, PaymentRecord } from '../../../persistence/ports/finance.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { TenancyService } from '../../tenancy/services/tenancy.service';
import type { CreateGatewayCheckoutInput, GatewayCheckout } from '../contracts';
import {
  MOMO_PAYMENT_CLIENT,
  type MomoIpnPayload,
  type MomoPaymentClient,
} from '../momo/momo-client';

function cents(v: DecimalString): bigint {
  if (!isNumeric18Scale2NonNegative(v)) {
    throw new BadRequestException('Amount must be a non-negative decimal with at most two decimals');
  }
  const [w, f = ''] = v.split('.');
  return BigInt(w) * 100n + BigInt(f.padEnd(2, '0'));
}

function vndInteger(amount: DecimalString): number {
  const value = cents(amount);
  if (value <= 0n) throw new BadRequestException('Payment amount must be positive');
  if (value % 100n !== 0n) {
    throw new BadRequestException('MoMo amount must be a whole VND value');
  }
  return Number(value / 100n);
}

@Injectable()
export class PaymentGatewayService {
  constructor(
    @Inject(TenancyService) private readonly tenancyService: TenancyService,
    @Inject(TRANSACTION_MANAGER) private readonly tx: TransactionManager,
    @Inject(MOMO_PAYMENT_CLIENT) private readonly momo: MomoPaymentClient,
  ) {}

  async createCheckout(input: CreateGatewayCheckoutInput, userId: string): Promise<GatewayCheckout> {
    await this.tenancyService.findById(input.tenancyId);
    const amountVnd = vndInteger(input.amount);
    const now = new Date().toISOString();
    const checkoutId = randomUUID();
    const orderId = checkoutId.replace(/-/g, '');
    const requestId = randomUUID().replace(/-/g, '');
    const referenceCode = `TROOI ${input.tenancyId.slice(0, 8).toUpperCase()} ${orderId.slice(-6).toUpperCase()}`;
    const created = await this.momo.createCaptureWallet({
      orderId,
      requestId,
      amountVnd,
      orderInfo: referenceCode,
      extraData: input.tenancyId,
    });
    const record: GatewayCheckoutRecord = {
      checkoutId,
      tenancyId: input.tenancyId,
      createdByUserId: userId,
      amount: input.amount,
      referenceCode,
      provider: 'MOMO',
      providerOrderId: orderId,
      providerRequestId: requestId,
      status: created.resultCode === 0 ? 'CREATED' : 'FAILED',
      payUrl: created.payUrl,
      deeplink: created.deeplink,
      resultingPaymentId: null,
      lastIpnPayload: null,
      lastIpnAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.tx.run(({ repositories }) => repositories.finance.insertGatewayCheckout(record));
    if (created.resultCode !== 0) {
      throw new BadRequestException(created.message || 'MoMo did not accept the checkout');
    }
    return this.toCheckout(record);
  }

  async findCheckout(id: string): Promise<GatewayCheckout> {
    const record = await this.tx.run(({ repositories }) => repositories.finance.findGatewayCheckout(id));
    if (!record) throw new NotFoundException(`Gateway checkout not found: ${id}`);
    return this.toCheckout(record);
  }

  async handleMomoIpn(payload: MomoIpnPayload): Promise<{ resultCode: number; message: string }> {
    if (!this.momo.verifyIpn(payload)) {
      throw new UnauthorizedException('Invalid MoMo IPN signature');
    }
    const now = new Date().toISOString();
    await this.tx.run(async ({ repositories }) => {
      const existing = await repositories.finance.findGatewayCheckoutByOrderId(payload.orderId);
      if (!existing) throw new NotFoundException(`Gateway checkout not found for order ${payload.orderId}`);
      await repositories.finance.lockGatewayCheckout(existing.checkoutId);
      const locked = await repositories.finance.findGatewayCheckout(existing.checkoutId);
      if (!locked) throw new NotFoundException(`Gateway checkout not found: ${existing.checkoutId}`);
      if (locked.status === 'SUCCEEDED' && locked.resultingPaymentId) {
        return;
      }
      const ipnAmount = String(payload.amount);
      const checkoutVnd = String(vndInteger(locked.amount));
      const failed =
        String(payload.resultCode) !== '0' || ipnAmount !== checkoutVnd;
      if (failed) {
        await repositories.finance.updateGatewayCheckout({
          ...locked,
          status: 'FAILED',
          lastIpnPayload: JSON.stringify(payload),
          lastIpnAt: now,
          updatedAt: now,
        });
        return;
      }
      const paymentId = randomUUID();
      const payment: PaymentRecord = {
        paymentId,
        tenancyId: locked.tenancyId,
        amount: locked.amount,
        source: 'GATEWAY',
        verification: 'PROVIDER_VERIFIED',
        confirmedAt: now,
        voidedOrReversedAt: null,
        correctionNote: null,
        replacementPaymentId: null,
      };
      await repositories.finance.insertPayment(payment);
      await repositories.finance.updateGatewayCheckout({
        ...locked,
        status: 'SUCCEEDED',
        resultingPaymentId: paymentId,
        lastIpnPayload: JSON.stringify(payload),
        lastIpnAt: now,
        updatedAt: now,
      });
      if (repositories.notification) {
        const participants = await repositories.tenancy?.findParticipantsByTenancy(locked.tenancyId);
        const linked = participants?.find((p) => p.userId && p.leftAt === null);
        if (linked?.userId) {
          await repositories.notification.createNotification({
            notificationId: randomUUID(),
            recipientUserId: linked.userId,
            category: 'PAYMENT_CONFIRMED',
            messageOrPayloadReference: `payment:${paymentId}`,
            deliveryStatus: 'PENDING',
            createdAt: now,
            deliveredAt: null,
            readAt: null,
          });
        }
      }
    });
    return { resultCode: 0, message: 'success' };
  }

  private toCheckout(record: GatewayCheckoutRecord): GatewayCheckout {
    return {
      id: record.checkoutId,
      tenancyId: record.tenancyId,
      amount: record.amount,
      referenceCode: record.referenceCode,
      provider: 'MOMO',
      status: record.status,
      createdAt: record.createdAt,
      ...(record.payUrl ? { payUrl: record.payUrl } : {}),
      ...(record.deeplink ? { deeplink: record.deeplink } : {}),
      ...(record.resultingPaymentId ? { resultingPaymentId: record.resultingPaymentId } : {}),
    };
  }
}

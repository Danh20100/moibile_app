import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { GatewayCheckout } from '../contracts';
import { CreateGatewayCheckoutDto, GatewayCheckoutDto, MomoIpnDto } from '../dto';
import { PaymentGatewayService } from '../services/payment-gateway.service';

@ApiTags('Payment Gateway')
@Controller('finance')
export class PaymentGatewayController {
  constructor(
    @Inject(PaymentGatewayService)
    private readonly gateway: PaymentGatewayService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post('checkouts')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOperation({ summary: 'Create a MoMo checkout session. Does not create a Payment.' })
  @ApiResponse({ status: 201, description: 'Checkout created', type: GatewayCheckoutDto })
  async createCheckout(
    @Body() dto: CreateGatewayCheckoutDto,
    @Headers('idempotency-key') key: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<GatewayCheckout> {
    if (!isUUID(key)) throw new BadRequestException('Idempotency-Key must be a UUID');
    await this.authz.assertCanAccessTenancy(user.userId, dto.tenancyId);
    return this.gateway.createCheckout(dto, user.userId, key);
  }

  @Get('checkouts/:id')
  @ApiOperation({ summary: 'Read a MoMo checkout session. CREATED is not a Payment.' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Checkout status', type: GatewayCheckoutDto })
  async findCheckout(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<GatewayCheckout> {
    const checkout = await this.gateway.findCheckout(id, user.userId);
    await this.authz.assertCanReadTenancy(user.userId, checkout.tenancyId);
    return checkout;
  }

  @Post('checkouts/:id/reconcile')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reconcile one SePay checkout from the production order API. Return URLs are ignored.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Checkout after reconciliation',
    type: GatewayCheckoutDto,
  })
  async reconcileSepay(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<GatewayCheckout> {
    if (!isUUID(id)) throw new BadRequestException('Invalid gateway checkout');
    return this.gateway.reconcileSepay(id, user.userId);
  }

  @Public()
  @Post('checkouts/sepay/ipn')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'SePay IPN. Raw {"success":true} is returned only after REST reconciliation commits a Payment.',
  })
  @ApiResponse({ status: 200, description: 'Payment is already committed' })
  @ApiResponse({ status: 400, description: 'Notification shape is not an ORDER_PAID invoice' })
  @ApiResponse({ status: 401, description: 'Secret rejected before any invoice lookup' })
  @ApiResponse({
    status: 409,
    description: 'Committed checkout conflicts with the corroborated order',
  })
  @ApiResponse({ status: 503, description: 'Order is unknown, pending, or not uniquely paid' })
  async sepayIpn(
    @Headers('x-secret-key') secret: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ success: true }> {
    return this.gateway.handleSepayIpn(secret, payload);
  }

  @Public()
  @Post('checkouts/momo/ipn')
  @HttpCode(204)
  @ApiOperation({ summary: 'MoMo IPN. Verified success is the only path that creates a Payment.' })
  @ApiResponse({ status: 204, description: 'IPN accepted without a response body' })
  async momoIpn(@Body() payload: MomoIpnDto): Promise<void> {
    return this.gateway.handleMomoIpn(payload);
  }
}

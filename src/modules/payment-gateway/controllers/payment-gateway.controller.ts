import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { GatewayCheckout } from '../contracts';
import { CreateGatewayCheckoutDto, GatewayCheckoutDto, MomoIpnResponseDto } from '../dto';
import type { MomoIpnPayload } from '../momo/momo-client';
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
  @ApiOperation({ summary: 'Create a MoMo checkout session. Does not create a Payment.' })
  @ApiResponse({ status: 201, description: 'Checkout created', type: GatewayCheckoutDto })
  async createCheckout(
    @Body() dto: CreateGatewayCheckoutDto,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<GatewayCheckout> {
    await this.authz.assertCanAccessTenancy(user.userId, dto.tenancyId);
    return this.gateway.createCheckout(dto, user.userId);
  }

  @Get('checkouts/:id')
  @ApiOperation({ summary: 'Read a MoMo checkout session. CREATED is not a Payment.' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Checkout status', type: GatewayCheckoutDto })
  async findCheckout(
    @Param('id') id: string,
    @CurrentUser() user: VerifiedPrincipal,
  ): Promise<GatewayCheckout> {
    const checkout = await this.gateway.findCheckout(id);
    await this.authz.assertCanReadTenancy(user.userId, checkout.tenancyId);
    return checkout;
  }

  @Public()
  @Post('checkouts/momo/ipn')
  @ApiOperation({ summary: 'MoMo IPN. Verified success is the only path that creates a Payment.' })
  @ApiResponse({ status: 201, description: 'IPN accepted', type: MomoIpnResponseDto })
  async momoIpn(@Body() payload: MomoIpnPayload): Promise<MomoIpnResponseDto> {
    return this.gateway.handleMomoIpn(payload);
  }
}

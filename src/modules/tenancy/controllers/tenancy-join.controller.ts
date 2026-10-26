import { Body, Controller, Inject, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import { TenancyJoinService } from '../services/tenancy-join.service';

class JoinTokenDto {
  @IsString()
  @Matches(/^[0-9a-fA-F]{64}$/)
  token!: string;
}

@ApiTags('Tenancy Join')
@Controller('tenancy-join')
export class TenancyJoinController {
  constructor(
    @Inject(TenancyJoinService) private readonly join: TenancyJoinService,
    @Inject(ResourceAuthorizationService) private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post('tenancies/:tenancyId/invitations')
  async issue(@Param('tenancyId') tenancyId: string, @CurrentUser() actor?: VerifiedPrincipal) {
    if (!actor) throw new UnauthorizedException();
    await this.authz.assertOperatesTenancy(actor.userId, tenancyId);
    return this.join.issue(tenancyId, actor.userId);
  }

  @Post('preview')
  async preview(@Body() body: JoinTokenDto, @CurrentUser() actor?: VerifiedPrincipal) {
    if (!actor) throw new UnauthorizedException();
    return this.join.preview(body.token);
  }

  @Post('accept')
  async accept(@Body() body: JoinTokenDto, @CurrentUser() actor?: VerifiedPrincipal) {
    if (!actor) throw new UnauthorizedException();
    return this.join.accept(body.token, actor.userId);
  }
}

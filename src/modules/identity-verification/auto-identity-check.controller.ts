import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common';
import type { VerifiedPrincipal } from '../identity-access/contracts';
import { AUTO_KYC_CONSENT, AutoIdentityCheckService } from './auto-identity-check.service';

export class SubmitAutoIdentityCheckDto {
  @IsBoolean() consent!: boolean;
  @IsIn([AUTO_KYC_CONSENT]) consentVersion!: string;
  @IsString() @MaxLength(2_000_004) frontImageBase64!: string;
  @IsString() @MaxLength(2_000_004) backImageBase64!: string;
  @IsString() @MaxLength(2_000_004) selfieImageBase64!: string;
}

@Controller('identity-verification')
export class AutoIdentityCheckController {
  constructor(private readonly checks: AutoIdentityCheckService) {}

  @Get('me')
  getMyCheck(@CurrentUser() user?: VerifiedPrincipal) {
    if (!user?.userId) throw new UnauthorizedException('Authentication required');
    return this.checks.latest(user.userId);
  }

  @Post('auto-check')
  submit(
    @CurrentUser() user: VerifiedPrincipal | undefined,
    @Body() request: SubmitAutoIdentityCheckDto,
  ) {
    if (!user?.userId) throw new UnauthorizedException('Authentication required');
    return this.checks.submit(user.userId, request);
  }
}

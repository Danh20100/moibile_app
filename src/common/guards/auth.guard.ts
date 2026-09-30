import { CanActivate, ExecutionContext, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import {
  GOOGLE_ID_TOKEN_VERIFIER,
  verifyGoogleIdToken,
  type GoogleIdTokenVerifier,
} from '../../integrations/google-identity';
import type { VerifiedPrincipal } from '../../modules/identity-access/contracts';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    // @Inject required: tsx strip-only mode does not emit design:paramtypes
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Optional()
    @Inject(GOOGLE_ID_TOKEN_VERIFIER)
    private readonly verifier?: GoogleIdTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: VerifiedPrincipal }>();
    const authHeader = request?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Yêu cầu xác thực Bearer token');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token không hợp lệ');
    }

    const principal = await verifyGoogleIdToken(this.verifier, token);
    request.user = principal;

    return true;
  }
}

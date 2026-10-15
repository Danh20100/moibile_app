import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import type { VerifiedPrincipal } from '../../modules/identity-access/contracts';

export function requireCurrentUser(ctx: ExecutionContext): VerifiedPrincipal {
  const request = ctx.switchToHttp().getRequest<Request & { user?: VerifiedPrincipal }>();
  if (!request.user) {
    throw new UnauthorizedException('Verified principal is required');
  }
  return request.user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): VerifiedPrincipal => requireCurrentUser(ctx),
);

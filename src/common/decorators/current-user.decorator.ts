import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { VerifiedPrincipal } from '../../modules/identity-access/contracts';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): VerifiedPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: VerifiedPrincipal }>();
    return request.user;
  },
);

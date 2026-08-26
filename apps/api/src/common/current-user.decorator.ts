import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtClaims } from '@vedaai/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: JwtClaims['role'];
  schoolId: string | null;
}

/** Injects the verified JWT subject into a controller handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest().user,
);

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtClaimsSchema } from '@vedaai/shared';
import type { AuthenticatedUser } from '@/common/current-user.decorator';

/**
 * Verifies the JWT that Auth.js (on the web app) signs with AUTH_SECRET. Both
 * sides must share the exact same secret — there is no session store and no
 * extra network hop.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Auth.js stores the token in an httpOnly cookie; accept it from there
        // too so server-side fetches work without manual header plumbing.
        (request) => request?.cookies?.['vedaai.token'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('AUTH_SECRET'),
    });
  }

  validate(payload: unknown): AuthenticatedUser {
    const parsed = jwtClaimsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException('Malformed token');
    }
    return {
      id: parsed.data.sub,
      email: parsed.data.email,
      role: parsed.data.role,
      schoolId: parsed.data.schoolId,
    };
  }
}

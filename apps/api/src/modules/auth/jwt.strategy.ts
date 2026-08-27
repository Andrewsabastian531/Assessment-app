import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtClaimsSchema } from '@vedaai/shared';
import type { AuthenticatedUser } from '@/common/current-user.decorator';

/** Verifies the JWT the API issued, signed with AUTH_SECRET. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // The web app keeps the token in an httpOnly cookie, so accept it there too.
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

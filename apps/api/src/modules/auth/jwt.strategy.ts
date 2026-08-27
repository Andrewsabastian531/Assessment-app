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
        /*
         * The cookie is accepted only alongside a header the browser will not
         * attach on its own. With SameSite=none the cookie rides along on any
         * cross-site request, so this is what stops a third-party page from
         * driving an authenticated call. Forms and <img> cannot set headers,
         * and an XHR that does triggers a preflight CORS rejects.
         */
        (request) =>
          request?.headers?.['x-vedaai-client']
            ? (request.cookies?.['vedaai.token'] ?? null)
            : null,
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

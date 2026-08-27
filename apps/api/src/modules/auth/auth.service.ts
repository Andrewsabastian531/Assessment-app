import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type {
  AuthResponse,
  JwtClaims,
  LoginInput,
  OAuthExchangeInput,
  RegisterInput,
  SessionUser,
} from '@vedaai/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtExpiry } from './jwt-expiry.type';

const USER_WITH_SCHOOL = {
  school: { select: { id: true, name: true, city: true, crestUrl: true } },
} as const;

interface UserWithSchool {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SessionUser['role'];
  avatarUrl: string | null;
  schoolId: string | null;
  school: { id: string; name: string; city: string | null; crestUrl: string | null } | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with that email already exists');
    }

    const school = await this.findOrCreateSchool(input.schoolName);

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: await bcrypt.hash(input.password, 10),
        schoolId: school.id,
      },
      include: USER_WITH_SCHOOL,
    });

    return this.issueToken(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: USER_WITH_SCHOOL,
    });

    // Compare against a dummy hash when the account is missing so the response
    // time does not reveal whether an email is registered.
    const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvaliduO';
    const valid = await bcrypt.compare(input.password, hash);

    if (!user || !user.passwordHash || !valid) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return this.issueToken(user);
  }

  /** Completes a social sign-in. */
  async exchangeOAuth(input: OAuthExchangeInput): Promise<AuthResponse> {
    const profile = await this.verifyGoogleIdToken(input.idToken);

    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: input.provider,
          providerAccountId: profile.sub,
        },
      },
      include: { user: { include: USER_WITH_SCHOOL } },
    });

    if (existingAccount) {
      return this.issueToken(existingAccount.user);
    }

    // Link to an existing password account with the same verified email rather
    // than creating a duplicate identity for the same person.
    const byEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
      include: USER_WITH_SCHOOL,
    });

    const user =
      byEmail ??
      (await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.picture,
          // No school yet — the teacher sets it from Settings after first sign-in.
          passwordHash: null,
        },
        include: USER_WITH_SCHOOL,
      }));

    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: input.provider,
        providerAccountId: profile.sub,
        email: profile.email,
      },
    });

    this.logger.log(`Linked ${input.provider} account for ${user.email}`);
    return this.issueToken(user);
  }

  isGoogleConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_CLIENT_ID', '') &&
      this.config.get<string>('GOOGLE_CLIENT_SECRET', ''),
    );
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_SCHOOL,
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return this.toSessionUser(user);
  }

  /** Matches on name case-insensitively so one school does not end up duplicated. */
  private async findOrCreateSchool(name: string) {
    const trimmed = name.trim();
    const existing = await this.prisma.school.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return existing;
    return this.prisma.school.create({ data: { name: trimmed }, select: { id: true } });
  }

  private async verifyGoogleIdToken(idToken: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID', '');
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is not configured on this server');
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    ).catch(() => null);

    if (!response?.ok) {
      throw new UnauthorizedException('Could not verify the Google sign-in');
    }

    const payload = (await response.json()) as {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
      given_name?: string;
      family_name?: string;
      name?: string;
      picture?: string;
    };

    // Without the audience check, a token minted for any other Google app would
    // be accepted here.
    if (payload.aud !== clientId) {
      throw new UnauthorizedException('This Google token was issued for another app');
    }
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Google did not return an email for this account');
    }
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      throw new UnauthorizedException('Your Google email address is not verified');
    }

    const [fallbackFirst = '', ...fallbackRest] = (payload.name ?? '').split(' ');

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      firstName: payload.given_name || fallbackFirst || payload.email.split('@')[0]!,
      lastName: payload.family_name || fallbackRest.join(' '),
      picture: payload.picture ?? null,
    };
  }

  private issueToken(user: UserWithSchool): AuthResponse {
    const claims: Omit<JwtClaims, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d');
    const accessToken = this.jwt.sign(claims, { expiresIn: expiresIn as JwtExpiry });

    return {
      accessToken,
      expiresIn: parseExpiry(expiresIn),
      user: this.toSessionUser(user),
    };
  }

  private toSessionUser(user: UserWithSchool): SessionUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      role: user.role,
      avatarUrl: user.avatarUrl,
      school: user.school,
    };
  }
}

/** Converts a jsonwebtoken-style duration ("7d", "12h") into seconds. */
function parseExpiry(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 604_800;
  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const multiplier = { s: 1, m: 60, h: 3600, d: 86_400 }[unit];
  return amount * multiplier;
}

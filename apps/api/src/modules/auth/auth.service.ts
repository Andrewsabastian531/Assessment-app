import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type {
  AuthResponse,
  JwtClaims,
  LoginInput,
  RegisterInput,
  SessionUser,
} from '@vedaai/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtExpiry } from './jwt-expiry.type';

const USER_WITH_SCHOOL = {
  school: { select: { id: true, name: true, city: true, crestUrl: true } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('An account with that email already exists');
    }

    const school = input.schoolName
      ? await this.prisma.school.create({ data: { name: input.schoolName } })
      : null;

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, 10),
        schoolId: school?.id ?? null,
      },
      include: USER_WITH_SCHOOL,
    });

    return this.issueToken(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
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

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_SCHOOL,
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return this.toSessionUser(user);
  }

  private issueToken(
    user: Awaited<ReturnType<PrismaService['user']['create']>> & {
      school: { id: string; name: string; city: string | null; crestUrl: string | null } | null;
    },
  ): AuthResponse {
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

  private toSessionUser(user: {
    id: string;
    email: string;
    name: string;
    role: SessionUser['role'];
    avatarUrl: string | null;
    school: { id: string; name: string; city: string | null; crestUrl: string | null } | null;
  }): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
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

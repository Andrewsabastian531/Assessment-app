import { z } from 'zod';
import { UserRole } from '../enums';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = loginSchema.extend({
  firstName: z.string().trim().min(1, 'Enter your first name').max(60),
  lastName: z.string().trim().min(1, 'Enter your last name').max(60),
  schoolName: z.string().trim().min(2, 'Enter your school name').max(160),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  /** Convenience field the shell renders; always `firstName lastName`. */
  name: z.string(),
  role: z.nativeEnum(UserRole),
  avatarUrl: z.string().url().nullable(),
  school: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable(),
      crestUrl: z.string().url().nullable(),
    })
    .nullable(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: sessionUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Claims embedded in the JWT the API issues and verifies. */
export const jwtClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  schoolId: z.string().nullable(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtClaims = z.infer<typeof jwtClaimsSchema>;

/** Identity providers the sign-in page can offer. */
export const OAUTH_PROVIDERS = ['google'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** Sent by the web app after it completes the Google authorization-code flow. */
export const oauthExchangeSchema = z.object({
  provider: z.enum(OAUTH_PROVIDERS),
  idToken: z.string().min(1),
});
export type OAuthExchangeInput = z.infer<typeof oauthExchangeSchema>;

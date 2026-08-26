import { z } from 'zod';
import { UserRole } from '../enums';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = loginSchema.extend({
  name: z.string().min(2, 'Enter your full name'),
  schoolName: z.string().min(2).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
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

/** Claims embedded in the JWT that Auth.js issues and NestJS verifies. */
export const jwtClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  schoolId: z.string().nullable(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtClaims = z.infer<typeof jwtClaimsSchema>;

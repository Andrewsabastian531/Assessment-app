import type { SignOptions } from 'jsonwebtoken';

/**
 * `@nestjs/jwt` types `expiresIn` as a `ms`-library template literal, which a
 * plain `string` from the config service cannot satisfy. The value is validated
 * at boot by the Zod env schema, so a narrow alias is safer than widening to
 * `any` and it keeps the assertion in one place.
 */
export type JwtExpiry = SignOptions['expiresIn'];

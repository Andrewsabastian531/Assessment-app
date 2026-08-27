import type { SignOptions } from 'jsonwebtoken';

/**
 * `@nestjs/jwt` types `expiresIn` as a `ms`-library template literal, which a plain
 * `string` from the config service cannot satisfy.
 */
export type JwtExpiry = SignOptions['expiresIn'];

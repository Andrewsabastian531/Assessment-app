import type { ZodType, ZodTypeDef } from 'zod';

export interface VlmImage {
  /** Raw image bytes. */
  data: Buffer;
  mimeType: string;
}

export interface VlmRequest<T> {
  model: string;
  system: string;
  prompt: string;
  images: VlmImage[];
  /** Response is constrained to this schema and validated before returning. */
  schema: ZodType<T, ZodTypeDef, unknown>;
  schemaName: string;
}

export interface VlmResponse<T> {
  data: T;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

/**
 * Every vision/grading call goes through this interface, so switching providers is an
 * env change (AI_PROVIDER) rather than a code change.
 */
export interface VlmProvider {
  readonly name: string;
  complete<T>(request: VlmRequest<T>): Promise<VlmResponse<T>>;
  embed(texts: string[], model: string): Promise<number[][]>;
}

/**
 * A quota or rate limit, as opposed to a broken request. Only this class triggers
 * a failover; a 400 means the next provider would reject the call too.
 */
export class ProviderQuotaError extends Error {
  override readonly name = 'ProviderQuotaError';

  constructor(
    message: string,
    readonly provider: string,
    /** How long the provider asked us to wait, when it says. */
    readonly retryAfterMs: number | null,
  ) {
    super(message);
  }
}

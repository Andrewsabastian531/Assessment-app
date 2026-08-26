import type { ZodType, ZodTypeDef } from 'zod';

export interface VlmImage {
  /** Raw image bytes. Providers base64-encode these themselves. */
  data: Buffer;
  mimeType: string;
}

export interface VlmRequest<T> {
  model: string;
  system: string;
  prompt: string;
  images: VlmImage[];
  /**
    * Response is constrained to this schema and validated before returning.
    * The Input parameter is left open because `.default()` makes a field
    * optional on input while it is required on output.
    */
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
 * Every vision/grading call goes through this interface, so switching providers
 * is an env change (AI_PROVIDER) rather than a code change.
 */
export interface VlmProvider {
  readonly name: string;
  complete<T>(request: VlmRequest<T>): Promise<VlmResponse<T>>;
  embed(texts: string[], model: string): Promise<number[][]>;
}

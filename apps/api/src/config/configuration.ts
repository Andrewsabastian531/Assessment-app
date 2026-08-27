import { z } from 'zod';

/** Every environment variable the API reads, validated once at boot. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),

  AUTH_SECRET: z
    .string()
    .min(
      16,
      'AUTH_SECRET must be at least 16 characters — generate one with `openssl rand -base64 32`',
    ),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SAMESITE: z.enum(['lax', 'none', 'strict']).default('lax'),
  COOKIE_DOMAIN: z.string().default(''),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),
  S3_PUBLIC_URL: z.string().url(),

  AI_PROVIDER: z
    .enum(['google', 'groq', 'openrouter', 'opencode-zen', 'anthropic', 'openai', 'ollama'])
    .default('google'),
  AI_VISION_MODEL: z.string().default('gemini-2.0-flash'),
  AI_GRADING_MODEL: z.string().default('gemini-2.0-flash'),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  /** Comma-separated providers to try when the primary reports a quota failure. */
  AI_FALLBACK_PROVIDERS: z.string().default(''),
  /** Per-provider ceiling. Keep it under the smallest free-tier quota in the chain. */
  AI_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(12),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),

  GOOGLE_AI_API_KEY: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENCODE_ZEN_API_KEY: z.string().default(''),
  OPENCODE_ZEN_BASE_URL: z.string().default('https://opencode.ai/zen/v1'),
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),

  EMBEDDING_PROVIDER: z.enum(['google', 'local', 'voyage', 'openai']).default('google'),
  EMBEDDING_MODEL: z.string().default('text-embedding-004'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  VOYAGE_API_KEY: z.string().default(''),
});

export type AppConfig = z.infer<typeof envSchema> & {
  corsOrigins: string[];
};

export function loadConfiguration(): AppConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\n`);
  }

  return {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

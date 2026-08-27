import { Logger } from '@nestjs/common';
import { toGeminiSchema } from './json-schema.util';
import {
  ProviderQuotaError,
  type VlmProvider,
  type VlmRequest,
  type VlmResponse,
} from './vlm-provider.interface';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
}

/** Google AI Studio (Gemini). */
export class GoogleVlmProvider implements VlmProvider {
  readonly name = 'google';
  private readonly logger = new Logger(GoogleVlmProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly maxRetries: number,
    private readonly embeddingDimensions: number,
    /** Lets the engine park its queue for as long as Gemini asks. */
    private readonly onRateLimit?: (retryAfterMs: number) => void,
  ) {}

  async complete<T>(request: VlmRequest<T>): Promise<VlmResponse<T>> {
    const startedAt = Date.now();

    const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
    for (const image of request.images) {
      parts.push({
        inline_data: { mime_type: image.mimeType, data: image.data.toString('base64') },
      });
    }

    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(request.schema, request.schemaName),
        temperature: 0.1,
      },
    };

    const payload = await this.post<GeminiResponse>(
      `/models/${request.model}:generateContent`,
      body,
    );

    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const reason = payload.candidates?.[0]?.finishReason ?? 'no candidates returned';
      throw new Error(`Gemini returned no content (${reason})`);
    }

    const parsed = request.schema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(
        `Gemini response did not match ${request.schemaName}: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ')}`,
      );
    }

    return {
      data: parsed.data,
      inputTokens: payload.usageMetadata?.promptTokenCount ?? null,
      outputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
      latencyMs: Date.now() - startedAt,
    };
  }

  async embed(texts: string[], model: string): Promise<number[][]> {
    interface BatchEmbedResponse {
      embeddings?: Array<{ values: number[] }>;
      error?: { message?: string };
    }

    const payload = await this.post<BatchEmbedResponse>(`/models/${model}:batchEmbedContents`, {
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        // gemini-embedding-001 returns 3072 dimensions unless asked otherwise.
        // The pgvector column is fixed-width, so this must be explicit.
        outputDimensionality: this.embeddingDimensions,
      })),
    });

    const embeddings = payload.embeddings?.map((entry) => entry.values);
    if (!embeddings || embeddings.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, received ${embeddings?.length ?? 0}`);
    }

    const width = embeddings[0]?.length ?? 0;
    if (width !== this.embeddingDimensions) {
      throw new Error(
        `Embedding model ${model} returned ${width} dimensions but the database ` +
          `column expects ${this.embeddingDimensions}. Set EMBEDDING_DIMENSIONS to ` +
          `match and run a Prisma migration, or pick a model of the right width.`,
      );
    }
    return embeddings;
  }

  /** Retries on 429 and 5xx with exponential backoff. */
  private async post<T>(path: string, body: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new Error(
        'GOOGLE_AI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and put it in .env',
      );
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${BASE_URL}${path}?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const payload = (await response.json()) as T & {
          error?: { message?: string; status?: string; details?: unknown[] };
        };

        if (!response.ok || payload.error) {
          const message = payload.error?.message ?? response.statusText;

          if (response.status === 429) {
            // Gemini states how long to wait. Guessing with backoff either wastes
            // time or spends another request against a quota already exhausted.
            const retryAfterMs = parseRetryDelay(payload.error?.details);
            this.onRateLimit?.(retryAfterMs ?? 60_000);
            throw new ProviderQuotaError(
              `Gemini quota exceeded: ${message}`,
              this.name,
              retryAfterMs,
            );
          }

          if (response.status >= 500 && attempt < this.maxRetries) {
            const delay = 2 ** attempt * 1500;
            this.logger.warn(`Gemini ${response.status} on ${path}; retrying in ${delay}ms`);
            await sleep(delay);
            continue;
          }

          throw new Error(`Gemini request failed (${response.status}): ${message}`);
        }

        return payload;
      } catch (error) {
        if (error instanceof ProviderQuotaError) throw error;
        lastError = error as Error;
        const aborted = lastError.name === 'AbortError';
        if (attempt >= this.maxRetries) break;
        if (!aborted && !lastError.message.includes('fetch failed')) break;
        await sleep(2 ** attempt * 1500);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error('Gemini request failed');
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reads the RetryInfo Gemini attaches to a 429, e.g. { retryDelay: "14.09s" }. */
function parseRetryDelay(details: unknown[] | undefined): number | null {
  for (const entry of details ?? []) {
    const delay = (entry as { retryDelay?: string })?.retryDelay;
    const seconds = delay && /^([\d.]+)s$/.exec(delay)?.[1];
    if (seconds) return Math.ceil(Number(seconds) * 1000);
  }
  return null;
}

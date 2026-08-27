import { Logger } from '@nestjs/common';
import { toJsonSchema } from './json-schema.util';
import type { VlmProvider, VlmRequest, VlmResponse } from './vlm-provider.interface';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/**
 * Any OpenAI-compatible `/chat/completions` gateway: OpenRouter, OpenCode Zen, OpenAI
 * itself, or a local Ollama in OpenAI mode.
 */
export class OpenAiCompatProvider implements VlmProvider {
  private readonly logger = new Logger(OpenAiCompatProvider.name);

  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly maxRetries: number,
    private readonly extraHeaders: Record<string, string> = {},
  ) {}

  async complete<T>(request: VlmRequest<T>): Promise<VlmResponse<T>> {
    const startedAt = Date.now();

    const content: Array<Record<string, unknown>> = [{ type: 'text', text: request.prompt }];
    for (const image of request.images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${image.mimeType};base64,${image.data.toString('base64')}`,
        },
      });
    }

    const payload = await this.post<ChatResponse>('/chat/completions', {
      model: request.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: toJsonSchema(request.schema, request.schemaName),
        },
      },
    });

    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(
        `${this.name} returned no content (${payload.choices?.[0]?.finish_reason ?? 'unknown'})`,
      );
    }

    const parsed = request.schema.safeParse(JSON.parse(stripCodeFence(text)));
    if (!parsed.success) {
      throw new Error(
        `${this.name} response did not match ${request.schemaName}: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ')}`,
      );
    }

    return {
      data: parsed.data,
      inputTokens: payload.usage?.prompt_tokens ?? null,
      outputTokens: payload.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - startedAt,
    };
  }

  async embed(texts: string[], model: string): Promise<number[][]> {
    interface EmbeddingResponse {
      data?: Array<{ embedding: number[]; index: number }>;
    }
    const payload = await this.post<EmbeddingResponse>('/embeddings', {
      model,
      input: texts,
    });
    const rows = payload.data;
    if (!rows || rows.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, received ${rows?.length ?? 0}`);
    }
    // Providers do not guarantee ordering; index is authoritative.
    return [...rows].sort((a, b) => a.index - b.index).map((row) => row.embedding);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            ...this.extraHeaders,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const payload = (await response.json()) as T & { error?: { message?: string } };

        if (!response.ok || payload.error) {
          const message = payload.error?.message ?? response.statusText;
          if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) {
            const delay = 2 ** attempt * 1500;
            this.logger.warn(`${this.name} ${response.status}; retrying in ${delay}ms`);
            await sleep(delay);
            continue;
          }
          throw new Error(`${this.name} request failed (${response.status}): ${message}`);
        }

        return payload;
      } catch (error) {
        lastError = error as Error;
        if (attempt >= this.maxRetries) break;
        await sleep(2 ** attempt * 1500);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error(`${this.name} request failed`);
  }
}

/** Some gateways wrap JSON in ```json fences despite response_format. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

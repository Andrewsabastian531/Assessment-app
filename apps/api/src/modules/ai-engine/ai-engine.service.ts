import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  gradingResultSchema,
  layoutAnalysisResultSchema,
  questionExtractionResultSchema,
  type GradingResult,
  type LayoutAnalysisResult,
  type QuestionExtractionResult,
  type QuestionType,
} from '@vedaai/shared';
import {
  GRADING_SYSTEM,
  LAYOUT_ANALYSIS_SYSTEM,
  QUESTION_EXTRACTION_SYSTEM,
  TYPE_GUIDANCE,
  gradingPrompt,
  layoutAnalysisPrompt,
  questionExtractionPrompt,
} from './prompts';
import { GoogleVlmProvider } from './providers/google.provider';
import { OpenAiCompatProvider } from './providers/openai-compat.provider';
import {
  ProviderQuotaError,
  type VlmImage,
  type VlmProvider,
  type VlmRequest,
  type VlmResponse,
} from './providers/vlm-provider.interface';
import { RateLimiter } from './rate-limiter';

export interface GradeAnswerInput {
  label: string;
  text: string;
  type: QuestionType;
  maxMarks: number;
  expectedAnswer: string | null;
  criteria: Array<{ description: string; marks: number }>;
  transcript: string;
  images: VlmImage[];
}

export interface GradeAnswerOutput extends GradingResult {
  modelId: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

@Injectable()
export class AiEngineService implements OnModuleInit {
  private readonly logger = new Logger(AiEngineService.name);
  private chain: Array<{ provider: VlmProvider; limiter: RateLimiter }> = [];

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const perMinute = this.config.get<number>('AI_REQUESTS_PER_MINUTE', 12);

    this.chain = this.providerNames().map((name) => {
      const limiter = new RateLimiter(name, perMinute);
      return {
        provider: this.buildProvider(name, (ms) => limiter.pauseFor(ms)),
        limiter,
      };
    });

    const names = this.chain.map((entry) => entry.provider.name).join(' -> ');
    this.logger.log(
      `AI providers: ${names} | vision ${this.visionModel} | grading ${this.gradingModel} | ${perMinute} req/min each`,
    );

    if (!this.hasCredentials()) {
      this.logger.warn(
        `No API key configured for "${this.provider.name}". Grading will fail until one is set — check GET /api/v1/health/ai.`,
      );
    }
  }

  /** The primary provider; the rest of the chain only runs on a quota failure. */
  private get provider(): VlmProvider {
    const first = this.chain[0]?.provider;
    if (!first) throw new Error('AI engine has no providers configured');
    return first;
  }

  private providerNames(): string[] {
    const primary = this.config.get<string>('AI_PROVIDER', 'google');
    const fallbacks = this.config
      .get<string>('AI_FALLBACK_PROVIDERS', '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    return [...new Set([primary, ...fallbacks])];
  }

  /**
   * Runs a request through the chain: rate limited per provider, and moved to the
   * next one only when the current provider reports a quota failure. Any other
   * error is the request's own fault and would fail identically elsewhere.
   */
  private async dispatch<T>(
    build: (provider: VlmProvider) => VlmRequest<T>,
  ): Promise<VlmResponse<T> & { providerName: string }> {
    let lastQuotaError: ProviderQuotaError | null = null;

    for (const [index, entry] of this.chain.entries()) {
      try {
        const response = await entry.limiter.run(() =>
          entry.provider.complete(build(entry.provider)),
        );
        if (index > 0) {
          this.logger.log(`Served by fallback provider "${entry.provider.name}"`);
        }
        return { ...response, providerName: entry.provider.name };
      } catch (error) {
        if (!(error instanceof ProviderQuotaError)) throw error;
        lastQuotaError = error;
        const next = this.chain[index + 1]?.provider.name;
        this.logger.warn(
          next
            ? `"${entry.provider.name}" is rate limited; trying "${next}"`
            : `"${entry.provider.name}" is rate limited and no fallback is configured`,
        );
      }
    }

    throw lastQuotaError ?? new Error('AI engine has no providers configured');
  }

  /** True when the selected provider has the key it needs. */
  hasCredentials(): boolean {
    const keyByProvider: Record<string, string> = {
      google: 'GOOGLE_AI_API_KEY',
      groq: 'GROQ_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      'opencode-zen': 'OPENCODE_ZEN_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
    };
    const key = keyByProvider[this.config.get<string>('AI_PROVIDER', 'google')];
    // Ollama runs locally and needs no key.
    if (!key) return true;
    return Boolean(this.config.get<string>(key, ''));
  }

  get visionModel(): string {
    return this.config.get<string>('AI_VISION_MODEL', 'gemini-2.0-flash');
  }

  get gradingModel(): string {
    return this.config.get<string>('AI_GRADING_MODEL', 'gemini-2.0-flash');
  }

  /** Question paper pages → structured, editable rubric. */
  async extractQuestions(pages: VlmImage[]): Promise<QuestionExtractionResult> {
    const response = await this.dispatch(() => ({
      model: this.gradingModel,
      system: QUESTION_EXTRACTION_SYSTEM,
      prompt: questionExtractionPrompt(pages.length),
      images: pages,
      schema: questionExtractionResultSchema,
      schemaName: 'QuestionExtractionResult',
    }));

    this.logger.log(
      `Extracted ${response.data.questions.length} questions in ${response.latencyMs}ms`,
    );
    return response.data;
  }

  /** One answer-sheet page → regions with bounding boxes and transcriptions. */
  async analyzeLayout(
    page: VlmImage,
    pageIndex: number,
    totalPages: number,
  ): Promise<LayoutAnalysisResult> {
    const response = await this.dispatch(() => ({
      model: this.visionModel,
      system: LAYOUT_ANALYSIS_SYSTEM,
      prompt: layoutAnalysisPrompt(pageIndex, totalPages),
      images: [page],
      schema: layoutAnalysisResultSchema,
      schemaName: 'LayoutAnalysisResult',
    }));

    // The model occasionally echoes a different index than it was told to use.
    return { ...response.data, pageIndex };
  }

  /** One student answer + its rubric → marks, verdict, step breakdown, feedback. */
  async gradeAnswer(input: GradeAnswerInput): Promise<GradeAnswerOutput> {
    const system = `${GRADING_SYSTEM}\n\n${TYPE_GUIDANCE[input.type]}`;

    const response = await this.dispatch(() => ({
      model: this.gradingModel,
      system,
      prompt: gradingPrompt({ ...input, hasImages: input.images.length > 0 }),
      images: input.images,
      schema: gradingResultSchema,
      schemaName: 'GradingResult',
    }));

    // The schema cannot express "not more than this question's maximum", so
    // clamp here rather than letting an over-award reach the database.
    const awardedMarks = clamp(response.data.awardedMarks, 0, input.maxMarks);
    if (awardedMarks !== response.data.awardedMarks) {
      this.logger.warn(
        `Q${input.label}: model awarded ${response.data.awardedMarks}/${input.maxMarks}, clamped to ${awardedMarks}`,
      );
    }

    return {
      ...response.data,
      awardedMarks,
      modelId: `${response.providerName}/${this.gradingModel}`,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const model = this.config.get<string>('EMBEDDING_MODEL', 'gemini-embedding-001');

    let lastQuotaError: ProviderQuotaError | null = null;
    for (const entry of this.chain) {
      try {
        return await entry.limiter.run(() => entry.provider.embed(texts, model));
      } catch (error) {
        if (!(error instanceof ProviderQuotaError)) throw error;
        lastQuotaError = error;
      }
    }
    throw lastQuotaError ?? new Error('AI engine has no providers configured');
  }

  /** Cheap liveness probe used by /health — confirms the model actually answers. */
  async ping(): Promise<{ ok: boolean; provider: string; model: string; error?: string }> {
    try {
      await this.embed(['ping']);
      return { ok: true, provider: this.provider.name, model: this.gradingModel };
    } catch (error) {
      return {
        ok: false,
        provider: this.provider.name,
        model: this.gradingModel,
        error: (error as Error).message,
      };
    }
  }

  private buildProvider(
    providerName: string,
    onRateLimit: (retryAfterMs: number) => void,
  ): VlmProvider {
    const timeoutMs = this.config.get<number>('AI_REQUEST_TIMEOUT_MS', 120_000);
    const maxRetries = this.config.get<number>('AI_MAX_RETRIES', 3);

    const openAiCompatible = (
      name: string,
      baseUrl: string,
      apiKey: string,
      headers: Record<string, string> = {},
    ) =>
      new OpenAiCompatProvider(
        name,
        baseUrl,
        apiKey,
        timeoutMs,
        maxRetries,
        headers,
        onRateLimit,
      );

    switch (providerName) {
      case 'google':
        return new GoogleVlmProvider(
          this.config.get<string>('GOOGLE_AI_API_KEY', ''),
          timeoutMs,
          maxRetries,
          this.config.get<number>('EMBEDDING_DIMENSIONS', 768),
          onRateLimit,
        );

      case 'groq':
        return openAiCompatible(
          'groq',
          'https://api.groq.com/openai/v1',
          this.config.get<string>('GROQ_API_KEY', ''),
        );

      case 'openrouter':
        return openAiCompatible(
          'openrouter',
          this.config.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
          this.config.get<string>('OPENROUTER_API_KEY', ''),
          {
            'HTTP-Referer': this.config.get<string>('OPENROUTER_SITE_URL', ''),
            'X-Title': this.config.get<string>('OPENROUTER_APP_NAME', 'VedaAI'),
          },
        );

      case 'opencode-zen':
        return openAiCompatible(
          'opencode-zen',
          this.config.get<string>('OPENCODE_ZEN_BASE_URL', 'https://opencode.ai/zen/v1'),
          this.config.get<string>('OPENCODE_ZEN_API_KEY', ''),
        );

      case 'openai':
        return openAiCompatible(
          'openai',
          'https://api.openai.com/v1',
          this.config.get<string>('OPENAI_API_KEY', ''),
        );

      case 'ollama':
        return openAiCompatible(
          'ollama',
          `${this.config.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434')}/v1`,
          'ollama',
        );

      default:
        throw new Error(
          `AI_PROVIDER "${providerName}" is not supported. Use one of: google, groq, openrouter, opencode-zen, openai, ollama.`,
        );
    }
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

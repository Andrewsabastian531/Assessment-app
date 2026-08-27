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
import type { VlmImage, VlmProvider } from './providers/vlm-provider.interface';

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
  private provider!: VlmProvider;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.provider = this.buildProvider();
    this.logger.log(
      `AI provider "${this.provider.name}" — vision: ${this.visionModel}, grading: ${this.gradingModel}`,
    );

    if (!this.hasCredentials()) {
      this.logger.warn(
        `No API key configured for provider "${this.provider.name}". The app will run, but any grading job will fail until you set one. Check GET /api/v1/health/ai.`,
      );
    }
  }

  /** True when the selected provider has the key it needs. */
  hasCredentials(): boolean {
    const keyByProvider: Record<string, string> = {
      google: 'GOOGLE_AI_API_KEY',
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
    const response = await this.provider.complete({
      model: this.gradingModel,
      system: QUESTION_EXTRACTION_SYSTEM,
      prompt: questionExtractionPrompt(pages.length),
      images: pages,
      schema: questionExtractionResultSchema,
      schemaName: 'QuestionExtractionResult',
    });

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
    const response = await this.provider.complete({
      model: this.visionModel,
      system: LAYOUT_ANALYSIS_SYSTEM,
      prompt: layoutAnalysisPrompt(pageIndex, totalPages),
      images: [page],
      schema: layoutAnalysisResultSchema,
      schemaName: 'LayoutAnalysisResult',
    });

    // The model occasionally echoes a different index than it was told to use.
    return { ...response.data, pageIndex };
  }

  /** One student answer + its rubric → marks, verdict, step breakdown, feedback. */
  async gradeAnswer(input: GradeAnswerInput): Promise<GradeAnswerOutput> {
    const system = `${GRADING_SYSTEM}\n\n${TYPE_GUIDANCE[input.type]}`;

    const response = await this.provider.complete({
      model: this.gradingModel,
      system,
      prompt: gradingPrompt({ ...input, hasImages: input.images.length > 0 }),
      images: input.images,
      schema: gradingResultSchema,
      schemaName: 'GradingResult',
    });

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
      modelId: `${this.provider.name}/${this.gradingModel}`,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const model = this.config.get<string>('EMBEDDING_MODEL', 'text-embedding-004');
    return this.provider.embed(texts, model);
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

  private buildProvider(): VlmProvider {
    const providerName = this.config.get<string>('AI_PROVIDER', 'google');
    const timeoutMs = this.config.get<number>('AI_REQUEST_TIMEOUT_MS', 120_000);
    const maxRetries = this.config.get<number>('AI_MAX_RETRIES', 3);

    switch (providerName) {
      case 'google':
        return new GoogleVlmProvider(
          this.config.get<string>('GOOGLE_AI_API_KEY', ''),
          timeoutMs,
          maxRetries,
          this.config.get<number>('EMBEDDING_DIMENSIONS', 768),
        );

      case 'openrouter':
        return new OpenAiCompatProvider(
          'openrouter',
          this.config.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
          this.config.get<string>('OPENROUTER_API_KEY', ''),
          timeoutMs,
          maxRetries,
          {
            'HTTP-Referer': this.config.get<string>('OPENROUTER_SITE_URL', ''),
            'X-Title': this.config.get<string>('OPENROUTER_APP_NAME', 'VedaAI'),
          },
        );

      case 'opencode-zen':
        return new OpenAiCompatProvider(
          'opencode-zen',
          this.config.get<string>('OPENCODE_ZEN_BASE_URL', 'https://opencode.ai/zen/v1'),
          this.config.get<string>('OPENCODE_ZEN_API_KEY', ''),
          timeoutMs,
          maxRetries,
        );

      case 'openai':
        return new OpenAiCompatProvider(
          'openai',
          'https://api.openai.com/v1',
          this.config.get<string>('OPENAI_API_KEY', ''),
          timeoutMs,
          maxRetries,
        );

      case 'ollama':
        return new OpenAiCompatProvider(
          'ollama',
          `${this.config.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434')}/v1`,
          'ollama',
          timeoutMs,
          maxRetries,
        );

      default:
        throw new Error(
          `AI_PROVIDER "${providerName}" is not supported. Use one of: google, openrouter, opencode-zen, openai, ollama.`,
        );
    }
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

import { z } from 'zod';
import { EvaluationVerdict, QuestionType } from '../enums';
import { boundingBoxSchema } from './common';

export const extractedQuestionSchema = z.object({
  label: z.string().describe('Printed question number exactly as shown, e.g. "2" or "2a"'),
  text: z.string().describe('Full question text, verbatim'),
  type: z.nativeEnum(QuestionType),
  maxMarks: z.number().nonnegative().describe('Marks printed alongside the question'),
  pageIndex: z.number().int().nonnegative(),
  bbox: boundingBoxSchema.nullable(),
  expectedAnswer: z
    .string()
    .nullable()
    .describe('Model answer if the paper prints one, otherwise null'),
  criteria: z
    .array(z.object({ description: z.string(), marks: z.number() }))
    .describe('Mark-scheme breakdown; empty when the paper gives none'),
  subQuestions: z
    .array(
      z.object({
        label: z.string(),
        text: z.string(),
        type: z.nativeEnum(QuestionType),
        maxMarks: z.number().nonnegative(),
      }),
    )
    .default([]),
});
export type ExtractedQuestion = z.infer<typeof extractedQuestionSchema>;

export const questionExtractionResultSchema = z.object({
  questions: z.array(extractedQuestionSchema),
  totalMarks: z.number().nonnegative().nullable(),
  detectedSubject: z.string().nullable(),
  detectedGrade: z.string().nullable(),
});
export type QuestionExtractionResult = z.infer<typeof questionExtractionResultSchema>;

export const detectedRegionSchema = z.object({
  bbox: boundingBoxSchema,
  transcript: z.string().describe('Handwritten content transcribed as faithfully as possible'),
  isPrintedLabel: z
    .boolean()
    .describe('True for pre-printed text such as a question number, false for student handwriting'),
  /** A printed "Q2." marker is near-decisive evidence for mapping. */
  questionLabelHint: z
    .string()
    .nullable()
    .describe('Question label this region appears to belong to, if legible'),
  confidence: z.number().min(0).max(1),
});
export type DetectedRegion = z.infer<typeof detectedRegionSchema>;

export const layoutAnalysisResultSchema = z.object({
  pageIndex: z.number().int().nonnegative(),
  regions: z.array(detectedRegionSchema),
});
export type LayoutAnalysisResult = z.infer<typeof layoutAnalysisResultSchema>;

export const gradingStepSchema = z.object({
  description: z.string().describe('What the student did on this step, and whether it was correct'),
  marksDelta: z.number().describe('Marks credited (positive) or deducted (negative) for this step'),
});
export type GradingStep = z.infer<typeof gradingStepSchema>;

export const gradingResultSchema = z.object({
  awardedMarks: z.number().nonnegative(),
  verdict: z.nativeEnum(EvaluationVerdict),
  feedback: z.string().describe('Line-by-line feedback addressed to the teacher, 2-4 sentences'),
  steps: z.array(gradingStepSchema).describe('Step-by-step breakdown; empty for simple MCQ'),
  confidence: z.number().min(0).max(1),
});
export type GradingResult = z.infer<typeof gradingResultSchema>;

export const AI_PROVIDERS = [
  'google',
  'openrouter',
  'opencode-zen',
  'anthropic',
  'openai',
  'ollama',
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const EMBEDDING_PROVIDERS = ['google', 'local', 'voyage', 'openai'] as const;
export type EmbeddingProvider = (typeof EMBEDDING_PROVIDERS)[number];

export const aiUsageSchema = z.object({
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  latencyMs: z.number().int().nonnegative(),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;

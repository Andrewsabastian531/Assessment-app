import { z } from 'zod';
import { EvaluationVerdict } from '../enums';
import { questionSchema } from './question';
import { answerRegionSchema, submissionPageSchema, submissionSchema } from './submission';

export const evaluationStepSchema = z.object({
  id: z.string(),
  orderIndex: z.number().int(),
  description: z.string(),
  /** Negative for a deduction, positive for credit awarded on that step. */
  marksDelta: z.number(),
  regionId: z.string().nullable(),
});
export type EvaluationStep = z.infer<typeof evaluationStepSchema>;

export const evaluationSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  questionId: z.string(),
  aiMarks: z.number(),
  awardedMarks: z.number(),
  maxMarks: z.number(),
  isOverridden: z.boolean(),
  verdict: z.nativeEnum(EvaluationVerdict),
  feedback: z.string(),
  steps: z.array(evaluationStepSchema),
  modelId: z.string().nullable(),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

/** Manual teacher override on the review screen. */
export const overrideEvaluationSchema = z.object({
  awardedMarks: z.number().nonnegative(),
  note: z.string().max(1000).optional(),
});
export type OverrideEvaluationInput = z.infer<typeof overrideEvaluationSchema>;

/** Everything the Question ⇄ Answer mapping screen needs in one round-trip. */
export const reviewPayloadSchema = z.object({
  submission: submissionSchema,
  questions: z.array(questionSchema),
  pages: z.array(submissionPageSchema),
  regions: z.array(answerRegionSchema),
  evaluations: z.array(evaluationSchema),
});
export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;

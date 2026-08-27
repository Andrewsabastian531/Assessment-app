import { z } from 'zod';
import { QuestionType } from '../enums';
import { boundingBoxSchema } from './common';

export const rubricCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  marks: z.number(),
  orderIndex: z.number().int(),
});
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

const questionBaseSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  parentId: z.string().nullable(),
  /** Printed label as it appears on the paper: "2", "2a", "3(ii)". */
  label: z.string(),
  text: z.string(),
  type: z.nativeEnum(QuestionType),
  maxMarks: z.number().nonnegative(),
  orderIndex: z.number().int(),
  sourcePage: z.number().int().nullable(),
  sourceBBox: boundingBoxSchema.nullable(),
  expectedAnswer: z.string().nullable(),
  criteria: z.array(rubricCriterionSchema),
});

/** Sub-questions ("2a", "2b") nest under their parent, so the type is recursive. */
export interface Question extends z.infer<typeof questionBaseSchema> {
  children?: Question[];
}

export const questionSchema: z.ZodType<Question> = questionBaseSchema.extend({
  children: z.lazy(() => z.array(questionSchema)).optional(),
});

/** Teacher edits to the auto-extracted rubric. */
export const updateQuestionSchema = z.object({
  label: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  type: z.nativeEnum(QuestionType).optional(),
  maxMarks: z.number().nonnegative().optional(),
  expectedAnswer: z.string().nullable().optional(),
  criteria: z
    .array(
      z.object({
        id: z.string().optional(),
        description: z.string().min(1),
        marks: z.number(),
        orderIndex: z.number().int(),
      }),
    )
    .optional(),
});
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

export const createQuestionSchema = z.object({
  parentId: z.string().nullable().optional(),
  label: z.string().min(1),
  text: z.string().min(1),
  type: z.nativeEnum(QuestionType).default('SHORT_ANSWER'),
  maxMarks: z.number().nonnegative(),
  orderIndex: z.number().int().optional(),
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

import { z } from 'zod';
import { SubmissionStatus } from '../enums';
import { boundingBoxSchema } from './common';

export const submissionPageSchema = z.object({
  id: z.string(),
  pageIndex: z.number().int().nonnegative(),
  imageKey: z.string(),
  /** Signed GET URL, minted on read — never persisted. */
  imageUrl: z.string().url().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type SubmissionPage = z.infer<typeof submissionPageSchema>;

/** A region of handwriting on a page. */
export const answerRegionSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  pageIndex: z.number().int().nonnegative(),
  questionId: z.string().nullable(),
  bbox: boundingBoxSchema,
  transcript: z.string(),
  isPrintedLabel: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type AnswerRegion = z.infer<typeof answerRegionSchema>;

export const submissionSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  studentName: z.string().nullable(),
  studentRollNo: z.string().nullable(),
  status: z.nativeEnum(SubmissionStatus),
  totalAwarded: z.number().nullable(),
  totalMax: z.number().nullable(),
  pageCount: z.number().int(),
  createdAt: z.string(),
});
export type Submission = z.infer<typeof submissionSchema>;

export const createSubmissionSchema = z.object({
  assessmentId: z.string(),
  assetId: z.string(),
  studentName: z.string().max(120).optional(),
  studentRollNo: z.string().max(60).optional(),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

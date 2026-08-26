import { z } from 'zod';
import { AssessmentStatus } from '../enums';
import { assetSchema } from './upload';

export const createAssessmentSchema = z.object({
  title: z.string().min(2, 'Give this exam a title').max(160),
  subject: z.string().max(80).optional(),
  grade: z.string().max(40).optional(),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = createAssessmentSchema.partial();
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

export const assessmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string().nullable(),
  grade: z.string().nullable(),
  status: z.nativeEnum(AssessmentStatus),
  teacherId: z.string(),
  schoolId: z.string().nullable(),
  questionCount: z.number().int(),
  submissionCount: z.number().int(),
  assets: z.array(assetSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Assessment = z.infer<typeof assessmentSchema>;

/** Fired by the "Start Mapping →" button. */
export const startMappingSchema = z.object({
  questionPaperAssetId: z.string(),
  answerSheetAssetId: z.string(),
  studentName: z.string().max(120).optional(),
  studentRollNo: z.string().max(60).optional(),
});
export type StartMappingInput = z.infer<typeof startMappingSchema>;

export const startMappingResponseSchema = z.object({
  jobId: z.string(),
  submissionId: z.string(),
  assessmentId: z.string(),
});
export type StartMappingResponse = z.infer<typeof startMappingResponseSchema>;

import { z } from 'zod';
import { EvaluationVerdict, JobStatus, PipelineStage } from './enums';

/** WebSocket contract. */
export const SERVER_EVENTS = {
  JOB_QUEUED: 'job.queued',
  JOB_PROGRESS: 'job.progress',
  PAGE_RASTERIZED: 'page.rasterized',
  EXTRACTION_COMPLETED: 'extraction.completed',
  MAPPING_COMPLETED: 'mapping.completed',
  EVALUATION_QUESTION_COMPLETED: 'evaluation.question.completed',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',
} as const;
export type ServerEventName = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];

export const CLIENT_EVENTS = {
  SUBSCRIBE_JOB: 'subscribe.job',
  SUBSCRIBE_SUBMISSION: 'subscribe.submission',
  UNSUBSCRIBE: 'unsubscribe',
} as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];

export const jobRoom = (jobId: string) => `job:${jobId}`;
export const submissionRoom = (submissionId: string) => `submission:${submissionId}`;

export const jobQueuedPayloadSchema = z.object({
  jobId: z.string(),
  submissionId: z.string(),
  assessmentId: z.string(),
  status: z.nativeEnum(JobStatus),
});
export type JobQueuedPayload = z.infer<typeof jobQueuedPayloadSchema>;

export const jobProgressPayloadSchema = z.object({
  jobId: z.string(),
  stage: z.custom<PipelineStage>(),
  /** Units completed within this stage (pages done, questions graded, …). */
  current: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Overall pipeline completion 0-100, weighted across stages. */
  percent: z.number().min(0).max(100),
  message: z.string(),
});
export type JobProgressPayload = z.infer<typeof jobProgressPayloadSchema>;

export const pageRasterizedPayloadSchema = z.object({
  jobId: z.string(),
  submissionId: z.string(),
  pageIndex: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});
export type PageRasterizedPayload = z.infer<typeof pageRasterizedPayloadSchema>;

export const extractionCompletedPayloadSchema = z.object({
  jobId: z.string(),
  assessmentId: z.string(),
  questionCount: z.number().int().nonnegative(),
});
export type ExtractionCompletedPayload = z.infer<typeof extractionCompletedPayloadSchema>;

export const mappingCompletedPayloadSchema = z.object({
  jobId: z.string(),
  submissionId: z.string(),
  matched: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
});
export type MappingCompletedPayload = z.infer<typeof mappingCompletedPayloadSchema>;

export const evaluationQuestionCompletedPayloadSchema = z.object({
  jobId: z.string(),
  submissionId: z.string(),
  questionId: z.string(),
  questionLabel: z.string(),
  awardedMarks: z.number(),
  maxMarks: z.number(),
  verdict: z.nativeEnum(EvaluationVerdict),
});
export type EvaluationQuestionCompletedPayload = z.infer<
  typeof evaluationQuestionCompletedPayloadSchema
>;

export const jobCompletedPayloadSchema = z.object({
  jobId: z.string(),
  submissionId: z.string(),
  assessmentId: z.string(),
  totalAwarded: z.number(),
  totalMax: z.number(),
  durationMs: z.number().int().nonnegative(),
});
export type JobCompletedPayload = z.infer<typeof jobCompletedPayloadSchema>;

export const jobFailedPayloadSchema = z.object({
  jobId: z.string(),
  submissionId: z.string().nullable(),
  stage: z.custom<PipelineStage>().nullable(),
  error: z.string(),
  retryable: z.boolean(),
});
export type JobFailedPayload = z.infer<typeof jobFailedPayloadSchema>;

/** Strongly-typed map used by both socket.io server and client generics. */
export interface ServerToClientEvents {
  [SERVER_EVENTS.JOB_QUEUED]: (p: JobQueuedPayload) => void;
  [SERVER_EVENTS.JOB_PROGRESS]: (p: JobProgressPayload) => void;
  [SERVER_EVENTS.PAGE_RASTERIZED]: (p: PageRasterizedPayload) => void;
  [SERVER_EVENTS.EXTRACTION_COMPLETED]: (p: ExtractionCompletedPayload) => void;
  [SERVER_EVENTS.MAPPING_COMPLETED]: (p: MappingCompletedPayload) => void;
  [SERVER_EVENTS.EVALUATION_QUESTION_COMPLETED]: (p: EvaluationQuestionCompletedPayload) => void;
  [SERVER_EVENTS.JOB_COMPLETED]: (p: JobCompletedPayload) => void;
  [SERVER_EVENTS.JOB_FAILED]: (p: JobFailedPayload) => void;
}

export interface ClientToServerEvents {
  [CLIENT_EVENTS.SUBSCRIBE_JOB]: (p: { jobId: string }) => void;
  [CLIENT_EVENTS.SUBSCRIBE_SUBMISSION]: (p: { submissionId: string }) => void;
  [CLIENT_EVENTS.UNSUBSCRIBE]: (p: { room: string }) => void;
}

/** Relative weight of each stage in the overall progress bar. */
export const STAGE_WEIGHTS: Record<PipelineStage, number> = {
  INGEST: 10,
  QUESTION_EXTRACTION: 20,
  LAYOUT_ANALYSIS: 30,
  MAPPING: 10,
  EVALUATION: 25,
  AGGREGATION: 5,
};

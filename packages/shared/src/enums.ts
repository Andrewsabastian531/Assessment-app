/**
 * Canonical enums shared by the API, the worker pipeline and the web client.
 * These mirror the Prisma enums one-for-one — keep both sides in sync.
 */

export const UserRole = {
  TEACHER: 'TEACHER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AssessmentStatus = {
  DRAFT: 'DRAFT',
  EXTRACTING: 'EXTRACTING',
  MAPPED: 'MAPPED',
  GRADING: 'GRADING',
  GRADED: 'GRADED',
  FAILED: 'FAILED',
} as const;
export type AssessmentStatus = (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

export const AssetKind = {
  QUESTION_PAPER: 'QUESTION_PAPER',
  ANSWER_SHEET: 'ANSWER_SHEET',
} as const;
export type AssetKind = (typeof AssetKind)[keyof typeof AssetKind];

export const QuestionType = {
  MCQ: 'MCQ',
  SHORT_ANSWER: 'SHORT_ANSWER',
  LONG_ANSWER: 'LONG_ANSWER',
  MATH_DERIVATION: 'MATH_DERIVATION',
  DIAGRAM: 'DIAGRAM',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const SubmissionStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  FINALIZED: 'FINALIZED',
  FAILED: 'FAILED',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const EvaluationVerdict = {
  CORRECT: 'CORRECT',
  PARTIAL: 'PARTIAL',
  INCORRECT: 'INCORRECT',
  UNATTEMPTED: 'UNATTEMPTED',
} as const;
export type EvaluationVerdict = (typeof EvaluationVerdict)[keyof typeof EvaluationVerdict];

export const JobType = {
  INGEST: 'INGEST',
  QUESTION_EXTRACTION: 'QUESTION_EXTRACTION',
  LAYOUT_ANALYSIS: 'LAYOUT_ANALYSIS',
  MAPPING: 'MAPPING',
  EVALUATION: 'EVALUATION',
  AGGREGATION: 'AGGREGATION',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/**
 * Human-readable stage labels surfaced on the "Extracting…" screen.
 * The order here is the order the pipeline runs in.
 */
export const PIPELINE_STAGES = [
  'INGEST',
  'QUESTION_EXTRACTION',
  'LAYOUT_ANALYSIS',
  'MAPPING',
  'EVALUATION',
  'AGGREGATION',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  INGEST: 'Preparing pages',
  QUESTION_EXTRACTION: 'Extracting questions',
  LAYOUT_ANALYSIS: 'Reading answer sheet',
  MAPPING: 'Matching answers to questions',
  EVALUATION: 'Grading answers',
  AGGREGATION: 'Finalising results',
};

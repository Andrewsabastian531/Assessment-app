import type { PipelineStage } from '@vedaai/shared';

/** Name of the BullMQ FlowProducer used to fan the pipeline out and back in. */
export const PIPELINE_FLOW = 'pipeline';

export const QUEUES = {
  INGEST: 'ingest',
  QUESTION_EXTRACTION: 'question-extraction',
  LAYOUT_ANALYSIS: 'layout-analysis',
  MAPPING: 'mapping',
  EVALUATION: 'evaluation',
  AGGREGATION: 'aggregation',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const ALL_QUEUES: QueueName[] = Object.values(QUEUES);

/** Shared job payload — every stage can resolve the whole pipeline from this. */
export interface PipelineJobData {
  jobId: string;
  assessmentId: string;
  submissionId: string;
  questionPaperAssetId: string;
  answerSheetAssetId: string;
}

export interface PageJobData extends PipelineJobData {
  pageId: string;
  pageIndex: number;
  totalPages: number;
}

export interface EvaluationJobData extends PipelineJobData {
  questionId: string;
}

export const STAGE_BY_QUEUE: Record<QueueName, PipelineStage> = {
  [QUEUES.INGEST]: 'INGEST',
  [QUEUES.QUESTION_EXTRACTION]: 'QUESTION_EXTRACTION',
  [QUEUES.LAYOUT_ANALYSIS]: 'LAYOUT_ANALYSIS',
  [QUEUES.MAPPING]: 'MAPPING',
  [QUEUES.EVALUATION]: 'EVALUATION',
  [QUEUES.AGGREGATION]: 'AGGREGATION',
};

/** Retry policy. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 4000 },
  removeOnComplete: { age: 3600, count: 200 },
  removeOnFail: { age: 86_400 },
};
